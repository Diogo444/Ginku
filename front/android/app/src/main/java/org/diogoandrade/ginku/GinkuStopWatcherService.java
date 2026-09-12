package org.diogoandrade.ginku;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * Foreground service qui interroge l'API Ginko toutes les 15s pour chaque arrêt
 * favori surveillé et déclenche une notification quand un bus/tram approche.
 * Tourne indépendamment du pont Capacitor/JS pour continuer même app fermée.
 */
public class GinkuStopWatcherService extends Service {
    static final String ACTION_REFRESH = "org.diogoandrade.ginku.action.REFRESH_STOP_WATCHER";
    static final String ACTION_STOP = "org.diogoandrade.ginku.action.STOP_STOP_WATCHER";

    private static final String TAG = "GinkuStopWatcher";

    // Doit rester alignée avec VITE_API_BASE_URL (front/.env.production) : le code
    // natif ne peut pas lire les variables d'environnement Vite au moment du build.
    private static final String API_BASE_URL = "https://ginku.diogo-andrade.org/api";

    private static final String WATCH_CHANNEL_ID = "ginku-watch-channel";
    private static final String ARRIVAL_CHANNEL_ID = "ginku-arrival-channel";
    private static final int WATCH_NOTIFICATION_ID = 1001;

    private static final int POLL_INTERVAL_SECONDS = 15;
    private static final int[] THRESHOLDS_MINUTES = { 2, 1 };
    private static final int CONNECT_TIMEOUT_MS = 8000;
    private static final int READ_TIMEOUT_MS = 8000;

    private ScheduledExecutorService executor;
    private final Map<String, StopNotificationState> stateByStopId = new HashMap<>();
    private final Map<String, StopStatus> statusByStopId = new HashMap<>();

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannels();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(@Nullable Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;

        if (ACTION_STOP.equals(action)) {
            stopForeground(STOP_FOREGROUND_REMOVE);
            stopSelf();
            return START_NOT_STICKY;
        }

        startForeground(WATCH_NOTIFICATION_ID, buildWatchNotification(WatchedStopsStore.load(this).length()));
        ensureExecutorRunning();

        return START_STICKY;
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        // Le service doit continuer à tourner même si l'utilisateur ferme l'app
        // depuis les applications récentes : comportement volontaire, ne rien faire.
        super.onTaskRemoved(rootIntent);
    }

    /**
     * Android 15+ (apps ciblant l'API 35+) impose une limite de temps d'exécution
     * cumulée aux foreground services de type "dataSync". Le système appelle ce
     * callback juste avant d'arrêter le service : on s'arrête proprement plutôt
     * que de laisser le système nous tuer brutalement.
     */
    public void onTimeout(int startId, int fgsType) {
        Log.w(TAG, "Limite d'exécution du foreground service atteinte (type " + fgsType + "), arrêt.");
        stopForeground(STOP_FOREGROUND_REMOVE);
        stopSelf(startId);
    }

    @Override
    public void onDestroy() {
        if (executor != null) {
            executor.shutdownNow();
            executor = null;
        }
        super.onDestroy();
    }

    private void ensureExecutorRunning() {
        if (executor != null && !executor.isShutdown()) return;

        executor = Executors.newSingleThreadScheduledExecutor();
        executor.scheduleWithFixedDelay(this::pollAll, 0, POLL_INTERVAL_SECONDS, TimeUnit.SECONDS);
    }

    private void pollAll() {
        JSONArray stops = WatchedStopsStore.load(this);

        if (stops.length() == 0) {
            stopSelf();
            return;
        }

        Set<String> currentIds = new HashSet<>();
        for (int i = 0; i < stops.length(); i++) {
            try {
                JSONObject stop = stops.getJSONObject(i);
                String id = stop.optString("id", null);
                if (id != null) currentIds.add(id);
                pollStop(stop);
            } catch (JSONException exception) {
                Log.w(TAG, "Entrée d'arrêt surveillé invalide", exception);
            }
        }

        // Nettoie les arrêts qui ne sont plus surveillés (ou dont le bus a disparu
        // des horaires) pour ne pas laisser une info périmée dans la notification.
        statusByStopId.keySet().retainAll(currentIds);
        stateByStopId.keySet().retainAll(currentIds);

        refreshWatchNotification();
    }

    private void pollStop(JSONObject stop) {
        String id = stop.optString("id", null);
        String nomArret = stop.optString("nomArret", null);
        String numLigne = stop.optString("numLigne", "");
        String idLigne = stop.optString("idLigne", null);
        String destination = stop.optString("destination", null);

        if (id == null || nomArret == null || idLigne == null || destination == null) return;

        try {
            JSONObject response = fetchTempsLieu(nomArret);
            JSONObject match = findMatchingPassage(response, idLigne, destination);
            if (match == null) {
                statusByStopId.remove(id);
                return;
            }

            int tempsEnSeconde = match.optInt("tempsEnSeconde", -1);
            if (tempsEnSeconde < 0) return;

            int tempsRestant = (int) Math.round(tempsEnSeconde / 60.0);
            String numVehicule = match.optString("numVehicule", "");

            statusByStopId.put(id, new StopStatus(numLigne, destination, tempsRestant));
            handlePassageUpdate(id, nomArret, numLigne, destination, numVehicule, tempsRestant);
        } catch (IOException | JSONException exception) {
            Log.w(TAG, "Impossible de récupérer les horaires pour " + nomArret, exception);
        }
    }

    private JSONObject fetchTempsLieu(String nomArret) throws IOException, JSONException {
        Uri uri = Uri.parse(API_BASE_URL).buildUpon()
            .appendPath("getTempsLieu")
            .appendPath(nomArret)
            .build();

        HttpURLConnection connection = (HttpURLConnection) new URL(uri.toString()).openConnection();
        connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
        connection.setReadTimeout(READ_TIMEOUT_MS);
        connection.setRequestMethod("GET");

        try {
            int status = connection.getResponseCode();
            if (status != HttpURLConnection.HTTP_OK) {
                throw new IOException("Réponse HTTP inattendue : " + status);
            }

            return new JSONObject(readStream(connection.getInputStream()));
        } finally {
            connection.disconnect();
        }
    }

    private static String readStream(InputStream inputStream) throws IOException {
        StringBuilder builder = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(inputStream, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                builder.append(line);
            }
        }
        return builder.toString();
    }

    @Nullable
    private static JSONObject findMatchingPassage(JSONObject response, String idLigne, String destination) throws JSONException {
        JSONArray listeTemps = response.optJSONArray("listeTemps");
        if (listeTemps == null) return null;

        for (int i = 0; i < listeTemps.length(); i++) {
            JSONObject passage = listeTemps.getJSONObject(i);
            if (idLigne.equals(passage.optString("idLigne", null)) &&
                destination.equals(passage.optString("destination", null))) {
                return passage;
            }
        }

        return null;
    }

    /**
     * Regroupe les seuils déjà atteints en une seule notification (utilise le seuil
     * le plus proche/urgent) pour éviter de spammer plusieurs alertes d'un coup,
     * par exemple à la toute première observation d'un passage déjà proche.
     */
    private void handlePassageUpdate(
        String stopId,
        String nomArret,
        String numLigne,
        String destination,
        String numVehicule,
        int tempsRestant
    ) {
        StopNotificationState state = stateByStopId.get(stopId);
        boolean isNewPassage = state == null || !state.lastVehicule.equals(numVehicule);
        if (isNewPassage) {
            state = new StopNotificationState(numVehicule);
            stateByStopId.put(stopId, state);
        }

        boolean shouldNotify = false;
        for (int threshold : THRESHOLDS_MINUTES) {
            if (tempsRestant <= threshold && !state.notifiedThresholds.contains(threshold)) {
                state.notifiedThresholds.add(threshold);
                shouldNotify = true;
            }
        }

        if (shouldNotify) {
            showArrivalNotification(stopId, nomArret, numLigne, destination, tempsRestant);
        }
    }

    private void showArrivalNotification(String stopId, String nomArret, String numLigne, String destination, int tempsRestant) {
        String ligneLabel = numLigne == null || numLigne.isEmpty() ? "Le bus/tram" : numLigne;
        String contentText = tempsRestant <= 0
            ? ligneLabel + " arrive maintenant à " + nomArret
            : ligneLabel + " arrive dans " + tempsRestant + " min à " + nomArret;

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, ARRIVAL_CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Arrêt " + nomArret + " — " + destination)
            .setContentText(contentText)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setContentIntent(buildContentIntent())
            .setOnlyAlertOnce(false)
            .setAutoCancel(true);

        try {
            NotificationManagerCompat.from(this).notify(stopId.hashCode(), builder.build());
        } catch (SecurityException exception) {
            Log.w(TAG, "Permission de notification manquante", exception);
        }
    }

    private Notification buildWatchNotification(int watchedCount) {
        String contentText = watchedCount <= 1
            ? "Surveillance d'un arrêt favori en cours"
            : "Surveillance de " + watchedCount + " arrêts favoris en cours";

        return new NotificationCompat.Builder(this, WATCH_CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Ginku")
            .setContentText(contentText)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(buildContentIntent())
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .build();
    }

    /**
     * Met à jour la notification permanente de surveillance avec les infos
     * temps réel (ligne, direction, temps restant) des arrêts surveillés,
     * au lieu du texte statique affiché avant le premier poll réussi.
     */
    private void refreshWatchNotification() {
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, WATCH_CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Ginku")
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(buildContentIntent())
            .setOngoing(true)
            .setOnlyAlertOnce(true);

        if (statusByStopId.isEmpty()) {
            builder.setContentText(buildFallbackText());
        } else {
            List<StopStatus> statuses = new ArrayList<>(statusByStopId.values());
            Collections.sort(statuses, Comparator.comparingInt(status -> status.tempsRestant));

            builder.setContentText(formatArrivalLine(statuses.get(0)));

            if (statuses.size() > 1) {
                StringBuilder bigText = new StringBuilder();
                for (StopStatus status : statuses) {
                    if (bigText.length() > 0) bigText.append('\n');
                    bigText.append(formatArrivalLine(status));
                }
                builder.setStyle(new NotificationCompat.BigTextStyle().bigText(bigText.toString()));
            }
        }

        try {
            NotificationManagerCompat.from(this).notify(WATCH_NOTIFICATION_ID, builder.build());
        } catch (SecurityException exception) {
            Log.w(TAG, "Permission de notification manquante", exception);
        }
    }

    private String buildFallbackText() {
        int watchedCount = WatchedStopsStore.load(this).length();
        return watchedCount <= 1
            ? "Surveillance d'un arrêt favori en cours"
            : "Surveillance de " + watchedCount + " arrêts favoris en cours";
    }

    private static String formatArrivalLine(StopStatus status) {
        String ligneLabel = status.numLigne == null || status.numLigne.isEmpty() ? "?" : status.numLigne;
        String tempsLabel = status.tempsRestant <= 0 ? "maintenant" : "dans " + status.tempsRestant + " min";

        return "Ligne " + ligneLabel + " direction " + status.destination + " arrive " + tempsLabel;
    }

    private PendingIntent buildContentIntent() {
        Intent launchIntent = new Intent(this, MainActivity.class);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;

        NotificationChannel watchChannel = new NotificationChannel(
            WATCH_CHANNEL_ID,
            "Surveillance des arrêts favoris",
            NotificationManager.IMPORTANCE_LOW
        );
        watchChannel.setDescription("Notification persistante indiquant que Ginku surveille vos arrêts favoris en arrière-plan.");
        manager.createNotificationChannel(watchChannel);

        NotificationChannel arrivalChannel = new NotificationChannel(
            ARRIVAL_CHANNEL_ID,
            "Arrivées de bus/tram",
            NotificationManager.IMPORTANCE_HIGH
        );
        arrivalChannel.setDescription("Alertes quand un bus ou un tram approche d'un arrêt favori surveillé.");
        manager.createNotificationChannel(arrivalChannel);
    }

    private static final class StopNotificationState {
        final String lastVehicule;
        final Set<Integer> notifiedThresholds = new HashSet<>();

        StopNotificationState(String lastVehicule) {
            this.lastVehicule = lastVehicule;
        }
    }

    private static final class StopStatus {
        final String numLigne;
        final String destination;
        final int tempsRestant;

        StopStatus(String numLigne, String destination, int tempsRestant) {
            this.numLigne = numLigne;
            this.destination = destination;
            this.tempsRestant = tempsRestant;
        }
    }
}

package org.diogoandrade.ginku;

import android.content.Context;
import android.content.Intent;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Pont JS <-> foreground service natif chargé de surveiller les arrêts favoris
 * en arrière-plan (voir GinkuStopWatcherService). La permission de notification
 * (POST_NOTIFICATIONS) est gérée côté JS par le plugin officiel @capacitor/local-notifications.
 */
@CapacitorPlugin(name = "GinkuStopWatcher")
public class GinkuStopWatcherPlugin extends Plugin {

    @PluginMethod
    public void sync(PluginCall call) {
        JSArray stopsArray = call.getArray("stops");
        if (stopsArray == null) {
            call.reject("Le paramètre 'stops' est requis.", "INVALID_ARGUMENT");
            return;
        }

        Context context = getContext();

        try {
            JSONArray stops = sanitizeStops(stopsArray);
            WatchedStopsStore.save(context, stops);

            Intent serviceIntent = new Intent(context, GinkuStopWatcherService.class);
            if (stops.length() > 0) {
                serviceIntent.setAction(GinkuStopWatcherService.ACTION_REFRESH);
                ContextCompat.startForegroundService(context, serviceIntent);
            } else {
                serviceIntent.setAction(GinkuStopWatcherService.ACTION_STOP);
                context.startService(serviceIntent);
            }

            call.resolve();
        } catch (JSONException exception) {
            call.reject("Impossible de traiter la liste des arrêts surveillés.", "INVALID_STOPS", exception);
        }
    }

    private static JSONArray sanitizeStops(JSArray stopsArray) throws JSONException {
        JSONArray sanitized = new JSONArray();

        for (int i = 0; i < stopsArray.length(); i++) {
            JSONObject stop = stopsArray.getJSONObject(i);

            String id = stop.optString("id", null);
            String nomArret = stop.optString("nomArret", null);
            String idLigne = stop.optString("idLigne", null);
            String destination = stop.optString("destination", null);
            if (id == null || nomArret == null || idLigne == null || destination == null) continue;

            JSONObject sanitizedStop = new JSONObject();
            sanitizedStop.put("id", id);
            sanitizedStop.put("nomArret", nomArret);
            sanitizedStop.put("idLigne", idLigne);
            sanitizedStop.put("numLigne", stop.optString("numLigne", ""));
            sanitizedStop.put("destination", destination);
            sanitized.put(sanitizedStop);
        }

        return sanitized;
    }
}

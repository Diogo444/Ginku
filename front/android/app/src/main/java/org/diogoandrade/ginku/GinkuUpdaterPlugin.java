package org.diogoandrade.ginku;

import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

@CapacitorPlugin(name = "GinkuUpdater")
public class GinkuUpdaterPlugin extends Plugin {
    static final long NO_DOWNLOAD_ID = -1L;
    private static final String PREFERENCES_NAME = "ginku_updater";
    private static final String PENDING_DOWNLOAD_ID_KEY = "pending_download_id";
    private static final String UPDATE_FILE_NAME = "Ginku-update.apk";
    private static final String RELEASE_HOST = "github.com";
    private static final String RELEASE_PATH_PREFIX = "/Diogo444/Ginku/releases/download/";

    @PluginMethod
    public void canInstallPackages(PluginCall call) {
        JSObject result = new JSObject();
        result.put("allowed", canInstallPackages(getContext()));
        call.resolve(result);
    }

    @PluginMethod
    public void openInstallPermission(PluginCall call) {
        Intent intent;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            intent = new Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:" + getContext().getPackageName())
            );
        } else {
            intent = new Intent(Settings.ACTION_SECURITY_SETTINGS);
        }

        if (getActivity() == null || intent.resolveActivity(getContext().getPackageManager()) == null) {
            call.reject("Les paramètres d'installation sont indisponibles.", "INSTALL_SETTINGS_UNAVAILABLE");
            return;
        }

        getActivity().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String url = call.getString("url");
        Uri uri = parseReleaseUri(url);

        if (uri == null) {
            call.reject("L'URL de l'APK est invalide.", "INVALID_APK_URL");
            return;
        }

        if (!canInstallPackages(getContext())) {
            call.reject("L'autorisation d'installer l'APK est requise.", "INSTALL_PERMISSION_REQUIRED");
            return;
        }

        DownloadManager downloadManager =
            (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);

        if (downloadManager == null) {
            call.reject("Le gestionnaire de téléchargements Android est indisponible.", "DOWNLOAD_MANAGER_UNAVAILABLE");
            return;
        }

        long pendingDownloadId = getPendingDownloadId(getContext());
        if (isDownloadRunning(downloadManager, pendingDownloadId)) {
            JSObject result = new JSObject();
            result.put("downloadId", pendingDownloadId);
            result.put("alreadyRunning", true);
            call.resolve(result);
            return;
        }

        clearPendingDownload(getContext());
        File updateFile = getUpdateFile(getContext());
        if (updateFile == null) {
            call.reject("Le dossier de téléchargement est indisponible.", "DOWNLOAD_DIRECTORY_UNAVAILABLE");
            return;
        }

        if (updateFile.exists() && !updateFile.delete()) {
            call.reject("L'ancien fichier de mise à jour ne peut pas être remplacé.", "UPDATE_FILE_UNAVAILABLE");
            return;
        }

        try {
            DownloadManager.Request request = new DownloadManager.Request(uri)
                .setTitle("Mise à jour de Ginku")
                .setDescription("Téléchargement de la nouvelle version")
                .setMimeType("application/vnd.android.package-archive")
                .setAllowedOverRoaming(false)
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                .setDestinationInExternalFilesDir(
                    getContext(),
                    Environment.DIRECTORY_DOWNLOADS,
                    UPDATE_FILE_NAME
                );

            long downloadId = downloadManager.enqueue(request);
            if (!storePendingDownload(getContext(), downloadId)) {
                downloadManager.remove(downloadId);
                call.reject("Le téléchargement ne peut pas être suivi.", "DOWNLOAD_STATE_UNAVAILABLE");
                return;
            }

            JSObject result = new JSObject();
            result.put("downloadId", downloadId);
            result.put("alreadyRunning", false);
            call.resolve(result);
        } catch (IllegalArgumentException | SecurityException exception) {
            call.reject("Impossible de démarrer le téléchargement de l'APK.", "DOWNLOAD_START_FAILED", exception);
        }
    }

    static File getUpdateFile(Context context) {
        File downloadsDirectory = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        return downloadsDirectory == null ? null : new File(downloadsDirectory, UPDATE_FILE_NAME);
    }

    static long getPendingDownloadId(Context context) {
        return getPreferences(context).getLong(PENDING_DOWNLOAD_ID_KEY, NO_DOWNLOAD_ID);
    }

    static void clearPendingDownload(Context context) {
        getPreferences(context).edit().remove(PENDING_DOWNLOAD_ID_KEY).apply();
    }

    private static boolean storePendingDownload(Context context, long downloadId) {
        return getPreferences(context).edit().putLong(PENDING_DOWNLOAD_ID_KEY, downloadId).commit();
    }

    private static SharedPreferences getPreferences(Context context) {
        return context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE);
    }

    private static boolean canInstallPackages(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            return context.getPackageManager().canRequestPackageInstalls();
        }

        return Settings.Secure.getInt(
            context.getContentResolver(),
            Settings.Secure.INSTALL_NON_MARKET_APPS,
            0
        ) == 1;
    }

    private static Uri parseReleaseUri(String url) {
        if (url == null || url.trim().isEmpty()) return null;

        Uri uri = Uri.parse(url.trim());
        String host = uri.getHost();
        String path = uri.getPath();

        if (
            !"https".equalsIgnoreCase(uri.getScheme()) ||
            host == null ||
            !RELEASE_HOST.equalsIgnoreCase(host) ||
            path == null ||
            !path.startsWith(RELEASE_PATH_PREFIX) ||
            !path.toLowerCase().endsWith(".apk")
        ) {
            return null;
        }

        return uri;
    }

    private static boolean isDownloadRunning(DownloadManager downloadManager, long downloadId) {
        if (downloadId == NO_DOWNLOAD_ID) return false;

        try (Cursor cursor = downloadManager.query(new DownloadManager.Query().setFilterById(downloadId))) {
            if (cursor == null || !cursor.moveToFirst()) return false;

            int status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
            return status == DownloadManager.STATUS_PENDING ||
                status == DownloadManager.STATUS_RUNNING ||
                status == DownloadManager.STATUS_PAUSED;
        }
    }
}

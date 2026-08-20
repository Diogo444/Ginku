package org.diogoandrade.ginku;

import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.util.Log;

import androidx.core.content.FileProvider;

import java.io.File;

public class GinkuUpdateDownloadReceiver extends BroadcastReceiver {
    private static final String TAG = "GinkuUpdater";
    private static final String APK_MIME_TYPE = "application/vnd.android.package-archive";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !DownloadManager.ACTION_DOWNLOAD_COMPLETE.equals(intent.getAction())) return;

        long expectedDownloadId = GinkuUpdaterPlugin.getPendingDownloadId(context);
        long completedDownloadId = intent.getLongExtra(
            DownloadManager.EXTRA_DOWNLOAD_ID,
            GinkuUpdaterPlugin.NO_DOWNLOAD_ID
        );

        if (expectedDownloadId == GinkuUpdaterPlugin.NO_DOWNLOAD_ID || completedDownloadId != expectedDownloadId) {
            return;
        }

        DownloadManager downloadManager =
            (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);

        if (downloadManager == null || !downloadSucceeded(downloadManager, completedDownloadId)) {
            GinkuUpdaterPlugin.clearPendingDownload(context);
            Log.e(TAG, "Le téléchargement de la mise à jour a échoué.");
            return;
        }

        File updateFile = GinkuUpdaterPlugin.getUpdateFile(context);
        if (updateFile == null || !updateFile.isFile()) {
            GinkuUpdaterPlugin.clearPendingDownload(context);
            Log.e(TAG, "Le fichier APK téléchargé est introuvable.");
            return;
        }

        try {
            Uri apkUri = FileProvider.getUriForFile(
                context,
                context.getPackageName() + ".fileprovider",
                updateFile
            );
            Intent installIntent = new Intent(Intent.ACTION_VIEW)
                .setDataAndType(apkUri, APK_MIME_TYPE)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);

            context.startActivity(installIntent);
        } catch (ActivityNotFoundException | IllegalArgumentException | SecurityException exception) {
            Log.e(TAG, "Impossible d'ouvrir l'installateur Android.", exception);
        } finally {
            GinkuUpdaterPlugin.clearPendingDownload(context);
        }
    }

    private boolean downloadSucceeded(DownloadManager downloadManager, long downloadId) {
        try (Cursor cursor = downloadManager.query(new DownloadManager.Query().setFilterById(downloadId))) {
            if (cursor == null || !cursor.moveToFirst()) return false;

            int status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
            return status == DownloadManager.STATUS_SUCCESSFUL;
        }
    }
}

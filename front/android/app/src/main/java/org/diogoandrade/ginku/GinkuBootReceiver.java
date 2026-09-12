package org.diogoandrade.ginku;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import androidx.core.content.ContextCompat;

import org.json.JSONArray;

/**
 * Relance la surveillance des arrêts favoris après un redémarrage du téléphone,
 * si au moins un favori avait les notifications activées avant l'extinction.
 */
public class GinkuBootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) return;

        JSONArray stops = WatchedStopsStore.load(context);
        if (stops.length() == 0) return;

        Intent serviceIntent = new Intent(context, GinkuStopWatcherService.class);
        serviceIntent.setAction(GinkuStopWatcherService.ACTION_REFRESH);
        ContextCompat.startForegroundService(context, serviceIntent);
    }
}

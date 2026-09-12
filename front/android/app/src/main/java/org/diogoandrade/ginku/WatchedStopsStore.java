package org.diogoandrade.ginku;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;

/**
 * Persistance partagée (plugin -> service -> receiver de boot) de la liste des
 * arrêts favoris à surveiller. Chaque entrée : {id, nomArret, idLigne, numLigne, destination}.
 */
final class WatchedStopsStore {
    private static final String PREFERENCES_NAME = "ginku_stop_watcher";
    private static final String STOPS_KEY = "watched_stops";

    private WatchedStopsStore() {}

    static void save(Context context, JSONArray stops) {
        getPreferences(context).edit().putString(STOPS_KEY, stops.toString()).apply();
    }

    static JSONArray load(Context context) {
        String raw = getPreferences(context).getString(STOPS_KEY, null);
        if (raw == null) return new JSONArray();

        try {
            return new JSONArray(raw);
        } catch (JSONException exception) {
            return new JSONArray();
        }
    }

    private static SharedPreferences getPreferences(Context context) {
        return context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE);
    }
}

package org.diogoandrade.ginku;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/** Enregistre le JSON via le sélecteur système, sans permission de stockage globale. */
@CapacitorPlugin(name = "GinkuDataExport")
public class GinkuDataExportPlugin extends Plugin {
    @PluginMethod
    public void save(PluginCall call) {
        String filename = call.getString("filename");
        String data = call.getString("data");
        if (filename == null || !filename.matches("ginku-sauvegarde-[0-9TZ-]+\\.json") || data == null) {
            call.reject("Les données d'export sont invalides.", "INVALID_EXPORT");
            return;
        }

        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/json");
        intent.putExtra(Intent.EXTRA_TITLE, filename);
        try {
            startActivityForResult(call, intent, "saveResult");
        } catch (ActivityNotFoundException exception) {
            call.reject("Le sélecteur de fichiers est indisponible.", "PICKER_UNAVAILABLE", exception);
        }
    }

    @ActivityCallback
    private void saveResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() == Activity.RESULT_CANCELED) {
            JSObject response = new JSObject();
            response.put("cancelled", true);
            call.resolve(response);
            return;
        }
        Uri uri = result.getData() == null ? null : result.getData().getData();
        String data = call.getString("data");
        if (result.getResultCode() != Activity.RESULT_OK || uri == null || data == null) {
            call.reject("Aucun fichier de sauvegarde sélectionné.", "INVALID_DESTINATION");
            return;
        }

        // Les fournisseurs de documents peuvent écrire vers le cloud : ne pas bloquer l'interface.
        getBridge().execute(() -> {
            try (OutputStream stream = getContext().getContentResolver().openOutputStream(uri, "wt")) {
                if (stream == null) throw new IOException("Flux de sauvegarde indisponible");
                stream.write(data.getBytes(StandardCharsets.UTF_8));
            } catch (IOException | SecurityException exception) {
                call.reject("Impossible d'enregistrer la sauvegarde.", "EXPORT_WRITE_FAILED", exception);
                return;
            }
            JSObject response = new JSObject();
            response.put("cancelled", false);
            call.resolve(response);
        });
    }
}

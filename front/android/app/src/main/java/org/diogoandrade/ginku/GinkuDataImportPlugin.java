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

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/** Lecture d'un document choisi explicitement, sans permission de stockage globale. */
@CapacitorPlugin(name = "GinkuDataImport")
public class GinkuDataImportPlugin extends Plugin {
    private static final int MAX_BACKUP_BYTES = 5 * 1024 * 1024;

    @PluginMethod
    public void open(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        // Certains fournisseurs classent les sauvegardes JSON comme du texte brut.
        intent.setType("*/*");
        intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[] { "application/json", "text/plain", "application/octet-stream" });
        try {
            startActivityForResult(call, intent, "openResult");
        } catch (ActivityNotFoundException exception) {
            call.reject("Le sélecteur de fichiers est indisponible.", "PICKER_UNAVAILABLE", exception);
        }
    }

    @ActivityCallback
    private void openResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() == Activity.RESULT_CANCELED) {
            JSObject response = new JSObject();
            response.put("cancelled", true);
            call.resolve(response);
            return;
        }
        Uri uri = result.getData() == null ? null : result.getData().getData();
        if (result.getResultCode() != Activity.RESULT_OK || uri == null) {
            call.reject("Aucun fichier sélectionné.", "INVALID_SOURCE");
            return;
        }
        getBridge().execute(() -> {
            try (InputStream stream = getContext().getContentResolver().openInputStream(uri);
                 ByteArrayOutputStream buffer = new ByteArrayOutputStream()) {
                if (stream == null) throw new IOException("Flux de lecture indisponible");
                byte[] chunk = new byte[8192];
                int count;
                while ((count = stream.read(chunk)) != -1) {
                    if (buffer.size() + count > MAX_BACKUP_BYTES) {
                        call.reject("Le fichier dépasse la limite de 5 Mio.", "IMPORT_TOO_LARGE");
                        return;
                    }
                    buffer.write(chunk, 0, count);
                }
                JSObject response = new JSObject();
                response.put("cancelled", false);
                response.put("data", new String(buffer.toByteArray(), StandardCharsets.UTF_8));
                call.resolve(response);
            } catch (IOException | SecurityException exception) {
                call.reject("Impossible de lire la sauvegarde.", "IMPORT_READ_FAILED", exception);
            }
        });
    }
}

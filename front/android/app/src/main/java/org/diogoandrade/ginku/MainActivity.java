package org.diogoandrade.ginku;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(GinkuUpdaterPlugin.class);
        registerPlugin(GinkuStopWatcherPlugin.class);
        registerPlugin(GinkuDataExportPlugin.class);
        registerPlugin(GinkuDataImportPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

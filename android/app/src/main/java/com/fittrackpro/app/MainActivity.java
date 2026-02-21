package com.fittrackpro.app;

import android.webkit.PermissionRequest;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;

public class MainActivity extends BridgeActivity {
    @Override
    protected BridgeWebChromeClient makeBridgeWebChromeClient() {
        return new BridgeWebChromeClient(this.bridge) {
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                request.grant(request.getResources());
            }
        };
    }
}

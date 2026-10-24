package com.systemy.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * Systemy — نظام تشغيلك الشخصي
 * غلاف WebView أصلي يحمّل واجهة التطبيق المدمجة (file://android_asset)
 * ويعمل دون اتصال بالكامل، مع استمرارية البيانات في localStorage.
 */
public class MainActivity extends Activity {

    private WebView webView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        setContentView(webView);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        // ضروري لقراءة الأصول المحلية من صفحة file:// دون شبكة
        s.setAllowFileAccessFromFileURLs(true);
        s.setAllowUniversalAccessFromFileURLs(true);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setMediaPlaybackRequiresUserGesture(true);
        // ثبات مقياس النص مهما كانت إعدادات خطوط النظام
        s.setTextZoom(100);
        // علامة تميّز WebView الخاص بنا — يستكشفها التطبيق لتفعيل وضع standalone
        String ua = s.getUserAgentString();
        if (ua == null || !ua.contains("SystemyWebView")) {
            s.setUserAgentString((ua == null ? "" : ua) + " SystemyWebView/1.0");
        }

        webView.setBackgroundColor(Color.parseColor("#070A12"));
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                String scheme = url.getScheme() == null ? "" : url.getScheme();
                if (scheme.equals("file") || scheme.equals("content")
                        || scheme.equals("data") || scheme.equals("blob")) {
                    return false; // حمّل محلياً داخل WebView
                }
                // أي رابط خارجي (http/https/mailto...) يفتح في المتصفح
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, url));
                } catch (Exception ignored) {
                    // لا يوجد تطبيق يستقبل الرابط — تجاهل بهدوء
                }
                return true;
            }
        });

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            webView.loadUrl("file:///android_asset/index.html");
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (webView != null) {
            webView.saveState(outState);
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }
}

package com.systemy.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * Systemy — نظام تشغيلك الشخصي
 * غلاف WebView أصلي يحمّل واجهة التطبيق المدمجة (file://android_asset)
 * ويعمل دون اتصال بالكامل، مع استمرارية البيانات في localStorage.
 *
 * عودة OAuth (5.3): متصفح النظام يفتح رابط ترخيص Google، وبعد الموافقة
 * Supabase يعيد التوجيه إلى systemy://auth/callback — أندرويد يوجّهه لهذا
 * النشاط (intent-filter في Manifest) فنسلّمه للواجهة عبر window.__systemyOAuthCallback
 * التي تبدل كود PKCE بجلسة Supabase. الوصول البارد يُحفظ معلقاً حتى تسحبه
 * الواجهة (takePendingOAuth) بعد اكتمال التحميل.
 */
public class MainActivity extends Activity {

    private WebView webView;
    /** رابط عودة OAuth وصل قبل جهوزية الواجهة (وصول بارد) — تسحبه الواجهة بنفسها */
    private String pendingOAuthUrl;
    /** هل اكتمل تحميل الصفحة؟ (يمكن دفع الرابط إليها مباشرة بعد ذلك) */
    private boolean pageLoaded = false;

    /** الجسر الأصلي المكشوف للواجهة كـ window.SystemyNative */
    private class SystemyNative {
        /** فتح رابط في متصفح النظام (موافقة Google تتم خارج WebView) */
        @JavascriptInterface
        public void openExternal(final String url) {
            if (url == null || url.isEmpty()) return;
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                    } catch (Exception ignored) {
                        // لا متصفح يستقبل الرابط — الواجهة تعرض خطأها الصادق
                    }
                }
            });
        }

        /** سحب رابط العودة المعلّق (وصول بارد) — إرجاعه وتفريغه ذرياً */
        @JavascriptInterface
        public synchronized String takePendingOAuth() {
            String u = pendingOAuthUrl;
            pendingOAuthUrl = null;
            return u == null ? "" : u;
        }
    }

    /** هل هذا الرابط عودة OAuth العميقة (systemy://auth/callback)? */
    private static boolean isOAuthCallback(Uri uri) {
        if (uri == null) return false;
        String scheme = uri.getScheme();
        String host = uri.getHost();
        String path = uri.getPath();
        return "systemy".equals(scheme) && "auth".equals(host) && "/callback".equals(path);
    }

    /** تسليم رابط العودة للواجهة — مباشرة إن كانت جاهزة، أو تعليقه حتى اكتمال التحميل */
    private void deliverOAuthUrl(String url) {
        if (url == null || url.isEmpty()) return;
        if (pageLoaded && webView != null) {
            pushToJs(url);
        } else {
            pendingOAuthUrl = url;
        }
    }

    /** دفع الرابط للواجهة — معالجها يخصم التكرار بنفسه (Set داخلي) */
    private void pushToJs(String url) {
        try {
            webView.evaluateJavascript(
                "window.__systemyOAuthCallback && window.__systemyOAuthCallback(" + jsString(url) + ")",
                null);
        } catch (Exception ignored) {
            // الواجهة لم تركّب المعالج بعد — الوصول البارد يغطيه takePendingOAuth
        }
    }

    /** ترميز نص آمن داخل سلسلة JSON ( escaping كامل) */
    private static String jsString(String s) {
        StringBuilder b = new StringBuilder("\"");
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '\\': b.append("\\\\"); break;
                case '"': b.append("\\\""); break;
                case '\n': b.append("\\n"); break;
                case '\r': b.append("\\r"); break;
                case '\t': b.append("\\t"); break;
                default:
                    if (c < 0x20) b.append(String.format("\\u%04x", (int) c));
                    else b.append(c);
            }
        }
        return b.append('"').toString();
    }

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

        // جسر OAuth العميق — تكشفه الواجهة كـ window.SystemyNative
        webView.addJavascriptInterface(new SystemyNative(), "SystemyNative");

        webView.setBackgroundColor(Color.parseColor("#070A12"));
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                String scheme = url.getScheme() == null ? "" : url.getScheme();
                // عودة OAuth العميقة داخل WebView نفسها؟ سلّمها للمعالج مباشرة
                if (scheme.equals("systemy")) {
                    deliverOAuthUrl(url.toString());
                    return true;
                }
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

            @Override
            public void onPageFinished(WebView view, String url) {
                pageLoaded = true;
                // وصول بارد: الصفحة اكتملت — ادفع الرابط المعلّق (المعالج يخصم التكرار)
                String pending = pendingOAuthUrl;
                if (pending != null) {
                    pendingOAuthUrl = null;
                    pushToJs(pending);
                }
            }
        });

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            webView.loadUrl("file:///android_asset/index.html");
        }

        // وصول بارد عبر الرابط العميق: التطبيق كان مغلقاً والرابط فتحه من المتصفح
        Uri cold = getIntent() != null ? getIntent().getData() : null;
        if (isOAuthCallback(cold)) {
            pendingOAuthUrl = cold.toString();
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        // عودة حية: التطبيق مفتوح في الخلفية والرابط العميق عاد إليه
        Uri uri = intent != null ? intent.getData() : null;
        if (isOAuthCallback(uri)) {
            deliverOAuthUrl(uri.toString());
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

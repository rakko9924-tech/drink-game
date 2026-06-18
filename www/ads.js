/* ads.js — AdMob ブリッジ（@capacitor-community/admob）
   ・ホーム/プレイ画面に下部バナー
   ・ルーレットを20回回すごとにインタースティシャル（全画面）
   ネイティブ(iOS/Capacitor)ではAdMobを使い、ブラウザ/PWAではプラグインが無いので
   プレースホルダーを表示してUX（出るタイミング・レイアウト）を確認できる。
   window.ADS = { showBanner(), hideBanner(), notifySpin() } を提供する。 */
(function () {
  // 本番AdMob（siosen323 / pub-1975437480047330, app ~1329866875）。実広告配信。
  const TESTING = false;
  const SPINS_PER_INTERSTITIAL = 20;

  const UNIT = {
    banner:       'ca-app-pub-1975437480047330/8508263135', // 本番 banner
    interstitial: 'ca-app-pub-1975437480047330/7003609779', // 本番 interstitial
  };

  let spinCount = 0;

  function getPlugin() {
    const C = window.Capacitor;
    if (!C) return null;
    // registerPlugin 構成 / 生www(Plugins直)構成 の両対応（AQUALUX教訓）
    if (C.Plugins && C.Plugins.AdMob) return C.Plugins.AdMob;
    return null;
  }

  /* ============ ネイティブ（AdMob） ============ */
  function nativeAds(AdMob) {
    let bannerVisible = false;
    let interReady = false;

    async function prepareInterstitial() {
      try { await AdMob.prepareInterstitial({ adId: UNIT.interstitial, isTesting: TESTING }); interReady = true; }
      catch (e) { interReady = false; }
    }

    // アプリがアクティブになってから ATT を明示要求 → 初期化（iPad等でダイアログが出ない問題の回避）
    setTimeout(function () {
      Promise.resolve()
        .then(function () { return AdMob.requestTrackingAuthorization ? AdMob.requestTrackingAuthorization() : null; })
        .catch(function () {})
        .then(function () { return AdMob.initialize({ initializeForTesting: TESTING }); })
        .then(prepareInterstitial)
        .catch(function () {});
    }, 800);

    return {
      async showBanner() {
        if (bannerVisible) return;
        bannerVisible = true;
        try {
          await AdMob.showBanner({
            adId: UNIT.banner,
            adSize: 'ADAPTIVE_BANNER',
            position: 'BOTTOM_CENTER',
            margin: 0,
            isTesting: TESTING,
          });
        } catch (e) { bannerVisible = false; }
      },
      async hideBanner() {
        if (!bannerVisible) return;
        bannerVisible = false;
        try { await AdMob.hideBanner(); } catch (e) {}
      },
      async _showInterstitial() {
        try {
          if (!interReady) await prepareInterstitial();
          await AdMob.showInterstitial();
        } catch (e) {}
        interReady = false;
        prepareInterstitial(); // 次回ぶんを仕込む
      },
      notifySpin() {
        spinCount++;
        if (spinCount % SPINS_PER_INTERSTITIAL === 0) this._showInterstitial();
      },
    };
  }

  /* ============ ブラウザ/PWA（プレースホルダー） ============ */
  function browserAds() {
    // 下部バナーの箱
    const banner = document.createElement('div');
    banner.id = 'ad-banner-ph';
    banner.textContent = '📢 広告バナー（テスト表示）';
    Object.assign(banner.style, {
      position: 'fixed', left: '0', right: '0', bottom: '0', height: 'var(--banner-h,56px)',
      display: 'none', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(255,255,255,.12)', color: 'rgba(255,255,255,.7)',
      fontSize: '13px', borderTop: '1px solid rgba(255,255,255,.15)', zIndex: '40',
      paddingBottom: 'env(safe-area-inset-bottom)',
    });
    document.body.appendChild(banner);

    function showInterstitialPH() {
      const ov = document.createElement('div');
      Object.assign(ov.style, {
        position: 'fixed', inset: '0', zIndex: '100', background: 'rgba(0,0,0,.92)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff',
      });
      ov.innerHTML =
        '<div style="font-size:40px">📺</div>' +
        '<div style="font-size:20px;font-weight:800;margin-top:10px">全画面広告（テスト表示）</div>' +
        '<div style="font-size:13px;opacity:.6;margin-top:6px">実機では全画面のAdMob広告が出ます</div>' +
        '<button id="ad-close-ph" style="margin-top:26px;padding:12px 28px;border:none;border-radius:30px;' +
        'background:#fff;color:#111;font-weight:800;font-size:15px">✕ 閉じる</button>';
      document.body.appendChild(ov);
      ov.querySelector('#ad-close-ph').onclick = () => ov.remove();
    }

    return {
      showBanner() { banner.style.display = 'flex'; },
      hideBanner() { banner.style.display = 'none'; },
      notifySpin() {
        spinCount++;
        if (spinCount % SPINS_PER_INTERSTITIAL === 0) showInterstitialPH();
      },
    };
  }

  function init() {
    const AdMob = getPlugin();
    window.ADS = AdMob ? nativeAds(AdMob) : browserAds();
    if (window.onAdsReady) window.onAdsReady();
  }

  document.addEventListener('deviceready', init, false);
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(init, 0);
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }
})();

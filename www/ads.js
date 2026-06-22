/* ads.js — 広告ブリッジ
   ・Web（ブラウザ/PWA）: Google AdSense（下部バナー / 20回ごとの全画面 / 解放用リワード風）
   ・ネイティブ(Capacitor/iOS): @capacitor-community/admob（※現状iOSは未公開。残置）
   window.ADS = { showBanner(), hideBanner(), notifySpin(), watchAdToUnlock(sec) } を提供。 */
(function () {
  /* ===== 設定（AdSense） =====
     ⚠️ AdSenseアカウント作成＆サイト審査承認後に、実際のスロットIDへ差し替える。
     client は AdMobと同一の publisher 番号を想定（ca-pub-1501117379039802）。要確認。 */
  const ADSENSE_CLIENT = 'ca-pub-1501117379039802';
  const SLOT = {
    banner:       '0000000001', // TODO: AdSenseで「ディスプレイ広告」ユニット作成→ID差し替え
    interstitial: '0000000002', // TODO: 同上（全画面用）
    reward:       '0000000003', // TODO: 同上（解放画面用）
  };
  const SLOTS_READY = false; // 実スロットIDを入れたら true（それまでは枠表示のみ＝審査用に空）

  const SPINS_PER_INTERSTITIAL = 20;
  const TESTING = false;
  let spinCount = 0;

  function getPlugin() {
    const C = window.Capacitor;
    if (C && C.Plugins && C.Plugins.AdMob) return C.Plugins.AdMob;
    return null;
  }

  /* ============ ネイティブ（AdMob・残置） ============ */
  function nativeAds(AdMob) {
    const UNIT = { banner:'ca-app-pub-1975437480047330/8508263135', interstitial:'ca-app-pub-1975437480047330/7003609779' };
    let bannerVisible = false, interReady = false;
    async function prep(){ try{ await AdMob.prepareInterstitial({adId:UNIT.interstitial,isTesting:TESTING}); interReady=true; }catch(e){ interReady=false; } }
    setTimeout(function(){ Promise.resolve()
      .then(function(){ return AdMob.requestTrackingAuthorization?AdMob.requestTrackingAuthorization():null; })
      .catch(function(){}).then(function(){ return AdMob.initialize({initializeForTesting:TESTING}); })
      .then(prep).catch(function(){}); }, 800);
    return {
      async showBanner(){ if(bannerVisible)return; bannerVisible=true; try{ await AdMob.showBanner({adId:UNIT.banner,adSize:'ADAPTIVE_BANNER',position:'BOTTOM_CENTER',margin:0,isTesting:TESTING}); }catch(e){ bannerVisible=false; } },
      async hideBanner(){ if(!bannerVisible)return; bannerVisible=false; try{ await AdMob.hideBanner(); }catch(e){} },
      async _inter(){ try{ if(!interReady)await prep(); await AdMob.showInterstitial(); }catch(e){} interReady=false; prep(); },
      notifySpin(){ spinCount++; if(spinCount%SPINS_PER_INTERSTITIAL===0) this._inter(); },
      watchAdToUnlock(){ return Promise.resolve(true); },
    };
  }

  /* ============ Web（AdSense） ============ */
  function webAds() {
    const banner = document.createElement('div');
    banner.id = 'ad-banner';
    Object.assign(banner.style, {
      position:'fixed', left:'0', right:'0', bottom:'0', minHeight:'var(--banner-h,56px)',
      display:'none', alignItems:'center', justifyContent:'center', overflow:'hidden',
      background:'rgba(255,255,255,.06)', zIndex:'40', paddingBottom:'env(safe-area-inset-bottom)',
    });
    document.body.appendChild(banner);

    function makeAdIns(slot, style){
      const ins = document.createElement('ins');
      ins.className = 'adsbygoogle';
      ins.style.display = 'block';
      if (style) Object.assign(ins.style, style);
      ins.setAttribute('data-ad-client', ADSENSE_CLIENT);
      ins.setAttribute('data-ad-slot', slot);
      ins.setAttribute('data-ad-format', 'auto');
      ins.setAttribute('data-full-width-responsive', 'true');
      return ins;
    }
    function pushAd(){ try{ (window.adsbygoogle = window.adsbygoogle || []).push({}); }catch(e){} }

    let bannerFilled = false;
    function fillBanner(){
      if (bannerFilled || !SLOTS_READY) return;
      bannerFilled = true;
      banner.appendChild(makeAdIns(SLOT.banner, { width:'100%', height:'56px' }));
      pushAd();
    }

    function placeholderBox(){
      return '<div style="opacity:.55;text-align:center;line-height:1.5">📺<br>広告枠<br><span style="font-size:12px">(AdSense承認後に表示)</span></div>';
    }

    // 全画面（20回ごと）
    function showInterstitial(){
      const ov = document.createElement('div');
      Object.assign(ov.style,{position:'fixed',inset:'0',zIndex:'100',background:'rgba(0,0,0,.94)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:'#fff',padding:'24px'});
      const box = document.createElement('div');
      Object.assign(box.style,{width:'100%',maxWidth:'360px',minHeight:'250px',display:'flex',alignItems:'center',justifyContent:'center'});
      if (SLOTS_READY){ box.appendChild(makeAdIns(SLOT.interstitial,{width:'300px',height:'250px'})); } else { box.innerHTML=placeholderBox(); }
      const close = document.createElement('button');
      Object.assign(close.style,{marginTop:'24px',padding:'12px 28px',border:'none',borderRadius:'30px',background:'#fff',color:'#111',fontWeight:'800',fontSize:'15px',opacity:'.5'});
      close.textContent='✕ 閉じる（5）'; close.disabled=true;
      ov.appendChild(box); ov.appendChild(close); document.body.appendChild(ov);
      if (SLOTS_READY) pushAd();
      let n=5; const t=setInterval(()=>{ n--; if(n<=0){ clearInterval(t); close.disabled=false; close.style.opacity='1'; close.textContent='✕ 閉じる'; } else close.textContent='✕ 閉じる（'+n+'）'; },1000);
      close.onclick=()=>{ if(!close.disabled) ov.remove(); };
    }

    // 解放用：長い広告を見てから解放
    function watchAdToUnlock(sec){
      sec = sec || 30;
      return new Promise((resolve, reject)=>{
        const ov = document.createElement('div');
        Object.assign(ov.style,{position:'fixed',inset:'0',zIndex:'120',background:'rgba(0,0,0,.96)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:'#fff',padding:'24px'});
        const title=document.createElement('div'); title.textContent='広告を最後まで見ると解放されます'; Object.assign(title.style,{fontWeight:'800',marginBottom:'14px',textAlign:'center'});
        const box=document.createElement('div'); Object.assign(box.style,{width:'100%',maxWidth:'360px',minHeight:'250px',display:'flex',alignItems:'center',justifyContent:'center'});
        if (SLOTS_READY){ box.appendChild(makeAdIns(SLOT.reward,{width:'300px',height:'250px'})); } else { box.innerHTML=placeholderBox(); }
        const bar=document.createElement('div'); Object.assign(bar.style,{width:'100%',maxWidth:'360px',height:'6px',borderRadius:'3px',background:'rgba(255,255,255,.2)',marginTop:'20px',overflow:'hidden'});
        const fill=document.createElement('div'); Object.assign(fill.style,{height:'100%',width:'0%',background:'linear-gradient(90deg,#ff3d7f,#ffd23d)',transition:'width 1s linear'}); bar.appendChild(fill);
        const note=document.createElement('div'); Object.assign(note.style,{fontSize:'13px',opacity:'.7',marginTop:'10px'});
        const cancel=document.createElement('button'); cancel.textContent='やめる'; Object.assign(cancel.style,{marginTop:'18px',padding:'8px 20px',border:'1px solid rgba(255,255,255,.4)',borderRadius:'24px',background:'transparent',color:'#fff',fontSize:'13px'});
        ov.appendChild(title); ov.appendChild(box); ov.appendChild(bar); ov.appendChild(note); ov.appendChild(cancel); document.body.appendChild(ov);
        if (SLOTS_READY) pushAd();
        let n=0; note.textContent='あと '+sec+' 秒';
        const t=setInterval(()=>{ n++; fill.style.width=Math.min(100,Math.round(n/sec*100))+'%'; note.textContent='あと '+Math.max(0,sec-n)+' 秒';
          if(n>=sec){ clearInterval(t); ov.remove(); resolve(true); } },1000);
        cancel.onclick=()=>{ clearInterval(t); ov.remove(); reject(new Error('cancel')); };
      });
    }

    return {
      showBanner(){ banner.style.display='flex'; fillBanner(); },
      hideBanner(){ banner.style.display='none'; },
      notifySpin(){ spinCount++; if(spinCount%SPINS_PER_INTERSTITIAL===0) showInterstitial(); },
      watchAdToUnlock,
    };
  }

  function init(){
    const AdMob = getPlugin();
    window.ADS = AdMob ? nativeAds(AdMob) : webAds();
    if (window.onAdsReady) window.onAdsReady();
  }
  document.addEventListener('deviceready', init, false);
  if (document.readyState==='complete' || document.readyState==='interactive') setTimeout(init,0);
  else document.addEventListener('DOMContentLoaded', init);
})();

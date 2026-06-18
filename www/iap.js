/* iap.js — App内課金ブリッジ（cordova-plugin-purchase / CdvPurchase v13）
   非消耗「大人のドキドキパック」(drinkgame.spicy_pack) を購入/復元し、
   index.html が期待する window.IAP = { purchase(id)->Promise, restore()->Promise<string[]>, owned(id) } に適合させる。
   ネイティブ(Capacitor/iOS)でのみ有効。ブラウザでは CdvPurchase が無いので何もしない（index側フォールバックが動く）。*/
(function () {
  var ID = 'drinkgame.spicy_pack';

  function init() {
    if (!window.CdvPurchase || window.IAP) return;
    var CdvPurchase = window.CdvPurchase;
    var store = CdvPurchase.store;
    var ProductType = CdvPurchase.ProductType;
    var Platform = CdvPurchase.Platform;
    var pending = {}; // productId -> {resolve, reject}

    store.register([{ id: ID, type: ProductType.NON_CONSUMABLE, platform: Platform.APPLE_APPSTORE }]);

    store.when()
      .approved(function (t) { t.verify(); })
      .verified(function (receipt) { receipt.finish(); })
      .finished(function (t) {
        (t.products || []).forEach(function (p) {
          if (pending[p.id]) { pending[p.id].resolve(); delete pending[p.id]; }
        });
      });

    store.error(function (err) {
      Object.keys(pending).forEach(function (id) { pending[id].reject(err); delete pending[id]; });
    });

    store.initialize([Platform.APPLE_APPSTORE]);

    window.IAP = {
      purchase: function (productId) {
        return new Promise(function (resolve, reject) {
          var p = store.get(productId, Platform.APPLE_APPSTORE);
          if (!p) { reject(new Error('product-not-found')); return; }
          pending[productId] = { resolve: resolve, reject: reject };
          var offer = p.getOffer();
          if (offer) { offer.order(); }
          else { delete pending[productId]; reject(new Error('no-offer')); }
        });
      },
      restore: function () {
        return Promise.resolve(store.restorePurchases()).then(function () {
          return [ID].filter(function (id) {
            var p = store.get(id, Platform.APPLE_APPSTORE);
            return p && p.owned;
          });
        });
      },
      owned: function (productId) {
        var p = store.get(productId, Platform.APPLE_APPSTORE);
        return !!(p && p.owned);
      },
    };
  }

  document.addEventListener('deviceready', init, false);
  if (document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(init, 0);
  else document.addEventListener('DOMContentLoaded', init);
})();

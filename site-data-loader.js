// ============================================================
// قصر عابدين — Data Loader
// يحمّل site-data.json ويجهّز البيانات للاستخدام
// ============================================================

(async function loadSiteData() {
  try {
    const res = await fetch('site-data.json?t=' + Date.now());
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();

    const converted = {
      config: data.config || {},
      social: data.social || {},

      // ===== الفروع =====
      branches: (data.branches || []).map(b => ({
        id: b.id || "",
        name: b.name || "",
        address: b.address || "",
        whatsapp: b.whatsapp || "",
        visible: b.visible !== false
      })),

      // ===== الصور المميزة =====
      featured: Array.isArray(data.featured) ? data.featured : [],

      // ===== العروض =====
      offers: (data.offers || []).map(o => ({
        id: o.id || "",
        image: o.image || "",
        text: o.text || ""
      })),

      // ===== الأقسام =====
      categories: (data.categories || []).map(cat => ({
        id: cat.id,
        icon: cat.icon || '🍞',
        name_ar: cat.name_ar || "",
        name_en: cat.name_en || "",
        homeImg: cat.homeImg || "",
        visible: cat.visible !== false,

        // نوع البيع
        sellType: cat.sellType === "weight" ? "weight" : "count",
        quantityUnit: cat.quantityUnit || (cat.sellType === "weight" ? "كيلو" : "قطعة"),
        quantityPresets: Array.isArray(cat.quantityPresets) && cat.quantityPresets.length > 0
          ? cat.quantityPresets
          : (cat.sellType === "weight" ? [0.25, 0.5, 1] : [10, 20, 30]),

        // المنتجات
        products: (cat.products || []).map(p => {
          const prod = {
            id: p.id || "",
            name_ar: p.name_ar || "",
            name_en: p.name_en || "",
            desc_ar: p.desc_ar || "",
            desc_en: p.desc_en || "",
            images: Array.isArray(p.images) ? p.images : [],
            price: Number(p.price) || 0,
            priceUnit: p.priceUnit || (cat.sellType === "weight" ? "كيلو" : "قطعة")
          };

          // variants (الأحجام)
          if (Array.isArray(p.variants) && p.variants.length > 0) {
            prod.variants = p.variants.map(v => ({
              label: v.label || "",
              price: Number(v.price) || 0
            }));
          }

          return prod;
        })
      }))
    };

    localStorage.setItem('abdeenStoreData', JSON.stringify(converted));

    console.log('✅ بيانات قصر عابدين محمّلة:',
      converted.categories.length, 'قسم |',
      converted.branches.length, 'فرع');

    window.dispatchEvent(new Event('storeDataReady'));

  } catch (e) {
    console.warn('⚠️ فشل تحميل site-data.json:', e.message);

    // بيانات احتياطية فاضية
    const fallback = {
      config: {
        brand_ar: "قصر عابدين للمخبوزات والحلويات",
        brand_en: "Abdeen Palace Bakery & Sweets",
        tagline_ar: "أشهى المخبوزات الشرقية والحلويات الفاخرة",
        about_ar: "",
        whatsappNumber: "",
        phones: [],
        address_ar: "",
        mapUrl: ""
      },
      social: {},
      branches: [],
      featured: [],
      offers: [],
      categories: []
    };

    localStorage.setItem('abdeenStoreData', JSON.stringify(fallback));
    window.dispatchEvent(new Event('storeDataReady'));
  }
})();
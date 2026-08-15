/* Interface language.
 *
 * Wording is taken from `docs/TRANSLATION.md` in the Android project, which
 * Billy approved on 2026-08-09 — reused verbatim wherever the same thing is
 * being said, so the two apps do not drift into two vocabularies.
 *
 * The same scope rules apply, and they matter more than the translation:
 *
 *   Asset types, Good/Damaged/Missing, North/South, segment numbers — these
 *   are DATA. They go into the spreadsheet and the signed report, so they stay
 *   English in both languages. Only field *labels* change.
 *
 *   "Segment" stays "Segment", not "Ruas" — the term the crew already uses.
 *
 *   The photo overlay stays English. It is burned into images that go into the
 *   signed report, and the report stays consistent.
 *
 *   The Excel column headers stay English. The office reads those.
 *
 * Indonesian does not inflect for plural, so "1 asset" and "N assets" collapse
 * into one string rather than needing a plural rule.
 *
 * Language code: this uses `id`, the BCP 47 tag the web wants. The Android app
 * uses `in` because Android's resource qualifier is the legacy code and
 * `values-id` is silently ignored. Same language, different platform spelling —
 * do not "align" them.
 */

(function (ARROW) {

  var STRINGS = {

    en: {
      /* Setup */
      app_tagline: 'Asset Registry and Reporting of Right Of Way',
      setup_name: 'Your name',
      setup_placeholder: 'e.g. Billy',
      setup_hint: 'Recorded against every asset and used in the Excel filename.',
      setup_start: 'Start',

      /* Form */
      change: 'Change',
      view: 'View',
      count_none: 'No assets recorded today',
      count_today: '%1$d recorded today',
      count_older: '%1$d from earlier days',
      count_unsent: '%1$d not sent yet',
      gps_waiting: 'Waiting for GPS…',
      gps_locked: 'GPS locked · ±%1$d m',
      gps_denied: 'Location permission denied — enable it in Settings',
      gps_unsupported: 'This browser has no GPS support',
      gps_hint_open: 'Step into the open if this takes a while',
      gps_hint_settings: 'Settings › Privacy › Location Services',
      label_zone: 'Zone',
      label_segment: 'Segment',
      label_asset_type: 'Asset Type',
      label_condition: 'Condition',
      label_kp: 'KP',
      label_note: 'Note (optional)',
      select_zone: 'Select zone…',
      select_segment: 'Select segment…',
      select_zone_first: 'Select zone first',
      select_type: 'Select type…',
      take_photo: 'Take Photo',
      go_export: 'Export Excel & Send',
      go_export_n: 'Export Excel & Send (%1$d)',

      /* Review */
      review_title: 'Review',
      review_save: 'Save Asset',
      review_retake: 'Retake Photo',
      review_discard: 'Discard',
      sum_segment: 'Segment',
      sum_type: 'Type',
      sum_condition: 'Condition',
      sum_kp: 'KP',
      sum_position: 'Position',
      sum_address: 'Address',
      sum_size: 'Size',
      sum_note: 'Note',
      address_later: 'Will be filled in when there is signal',
      processing_photo: 'Processing photo…',
      saved: 'Saved',
      lost_gps: 'Lost the GPS fix — try again',
      photo_failed: 'Could not process that photo',
      save_failed: 'Could not save: %1$s',

      /* Recorded list */
      back: 'Back',
      list_title: 'Recorded (%1$d)',
      nothing_recorded: 'Nothing recorded yet.',
      delete: 'Delete',
      deleted: 'Deleted',
      delete_confirm: 'Delete this %1$s? The photo goes with it.',
      address_pending: 'Address pending',

      /* Export */
      export_title: 'Export',
      export_nothing: 'Nothing recorded yet.',
      export_nothing_new: 'Nothing new since the last file. Everything recorded has been sent.',
      export_count_day: '%1$d assets from %2$s',
      export_count_days: '%1$d assets from %2$d days: %3$s',
      include_add: 'Also include the %1$d already sent',
      include_remove: 'Leave out the %1$d already sent',
      addr_online: '%1$d records still need an address. They will be filled in ' +
                   'when you build the file, as far as the signal allows.',
      addr_offline: '%1$d records have no address yet, and you are offline. ' +
                    'Street, Sub-District, District and Regency will be blank ' +
                    'for those rows — coordinates are unaffected.',
      build_file: 'Build Excel File',
      send_whatsapp: 'Send to WhatsApp',
      save_to_files: 'Save to Files',
      clear_sent: 'Clear sent records',
      st_addresses: 'Filling in addresses…',
      st_addresses_n: 'Filling in addresses… %1$d of %2$d',
      st_building: 'Building the workbook…',
      st_photos: 'Adding photos… %1$d of %2$d',
      st_ready: 'Ready. Photos are %1$s × %2$s cm in column N.',
      st_failed: 'Failed: %1$s',
      st_sent: 'Sent. Those %1$d are marked as gone, so the next file will only ' +
               'carry what you record from here.',
      st_share_failed: 'Sharing failed. Use "Save to Files" and attach it in WhatsApp.',
      st_share_failed_detail: 'Sharing failed — %1$s. Use "Save to Files" below, ' +
                             'then attach the file in WhatsApp.',
      st_share_unsupported: 'This browser cannot share files directly. Use ' +
                            '"Save to Files", then attach it in WhatsApp.',
      st_downloaded: 'Saved to Files, and marked as sent.',
      file_meta: '%1$s  ·  %2$s MB  ·  %3$d rows',
      clear_none: 'Nothing has been sent yet — nothing to clear',
      clear_confirm: 'Delete %1$d already-sent records and their photos?\n\n' +
                     'Anything not yet sent is kept. Do this only once the Excel ' +
                     'has actually arrived in the group.',
      cleared: 'Cleared %1$d',
      nothing_to_export: 'Nothing to export',
      backfilled: 'Filled in %1$d addresses'
    },

    id: {
      /* Setup — the expansion of the name stays English; it is what the signed
         report calls the system. */
      app_tagline: 'Asset Registry and Reporting of Right Of Way',
      setup_name: 'Nama Anda',
      setup_placeholder: 'contoh: Billy',
      setup_hint: 'Tercatat pada setiap aset dan dipakai pada nama berkas Excel.',
      setup_start: 'Mulai',

      /* Form */
      change: 'Ganti',
      view: 'Lihat',
      count_none: 'Belum ada aset direkam hari ini',
      count_today: '%1$d direkam hari ini',
      count_older: '%1$d dari hari sebelumnya',
      count_unsent: '%1$d belum terkirim',
      gps_waiting: 'Menunggu GPS…',
      gps_locked: 'GPS terkunci · ±%1$d m',
      gps_denied: 'Izin lokasi ditolak — aktifkan di Pengaturan',
      gps_unsupported: 'Peramban ini tidak mendukung GPS',
      gps_hint_open: 'Cari tempat terbuka jika ini terlalu lama',
      gps_hint_settings: 'Pengaturan › Privasi › Layanan Lokasi',
      label_zone: 'Zona',
      label_segment: 'Segment',
      label_asset_type: 'Jenis Asset',
      label_condition: 'Kondisi',
      label_kp: 'KP',
      label_note: 'Catatan (opsional)',
      select_zone: 'Pilih zona…',
      select_segment: 'Pilih segment…',
      select_zone_first: 'Pilih zona dulu',
      select_type: 'Pilih jenis…',
      take_photo: 'Ambil Foto',
      go_export: 'Ekspor Excel & Kirim',
      go_export_n: 'Ekspor Excel & Kirim (%1$d)',

      /* Review */
      review_title: 'Periksa',
      review_save: 'Simpan Aset',
      review_retake: 'Ulangi Foto',
      review_discard: 'Buang',
      sum_segment: 'Segment',
      sum_type: 'Jenis',
      sum_condition: 'Kondisi',
      sum_kp: 'KP',
      sum_position: 'Posisi',
      sum_address: 'Alamat',
      sum_size: 'Ukuran',
      sum_note: 'Catatan',
      address_later: 'Akan diisi saat ada sinyal',
      processing_photo: 'Memproses foto…',
      saved: 'Tersimpan',
      lost_gps: 'Sinyal GPS hilang — coba lagi',
      photo_failed: 'Foto tidak dapat diproses',
      save_failed: 'Gagal menyimpan: %1$s',

      /* Recorded list */
      back: 'Kembali',
      list_title: 'Aset terekam (%1$d)',
      nothing_recorded: 'Belum ada yang direkam.',
      delete: 'Hapus',
      deleted: 'Terhapus',
      delete_confirm: 'Hapus %1$s ini? Fotonya ikut terhapus.',
      address_pending: 'Alamat menunggu',

      /* Export — the column names inside this text stay English, because that
         is what the operator will see when the spreadsheet is opened. */
      export_title: 'Ekspor',
      export_nothing: 'Belum ada yang direkam.',
      export_nothing_new: 'Tidak ada data baru sejak berkas terakhir. ' +
                          'Semua yang direkam sudah terkirim.',
      export_count_day: '%1$d aset dari %2$s',
      export_count_days: '%1$d aset dari %2$d hari: %3$s',
      include_add: 'Sertakan juga %1$d yang sudah terkirim',
      include_remove: 'Kecualikan %1$d yang sudah terkirim',
      addr_online: '%1$d rekaman masih perlu alamat. Akan diisi saat berkas ' +
                   'dibuat, sejauh sinyal memungkinkan.',
      addr_offline: '%1$d rekaman belum punya alamat dan Anda sedang luring. ' +
                    'Kolom Street, Sub-District, District dan Regency akan ' +
                    'kosong untuk baris itu — koordinat tidak terpengaruh.',
      build_file: 'Buat Berkas Excel',
      send_whatsapp: 'Kirim ke WhatsApp',
      save_to_files: 'Simpan ke Files',
      clear_sent: 'Hapus rekaman terkirim',
      st_addresses: 'Mengisi alamat…',
      st_addresses_n: 'Mengisi alamat… %1$d dari %2$d',
      st_building: 'Menyusun berkas…',
      st_photos: 'Menambahkan foto… %1$d dari %2$d',
      st_ready: 'Siap. Foto berukuran %1$s × %2$s cm di kolom N.',
      st_failed: 'Gagal: %1$s',
      st_sent: 'Terkirim. %1$d itu ditandai sudah dikirim, jadi berkas ' +
               'berikutnya hanya memuat yang Anda rekam mulai sekarang.',
      st_share_failed: 'Gagal membagikan. Gunakan "Simpan ke Files" lalu ' +
                       'lampirkan di WhatsApp.',
      st_share_failed_detail: 'Gagal membagikan — %1$s. Gunakan "Simpan ke ' +
                             'Files" di bawah, lalu lampirkan berkasnya di WhatsApp.',
      st_share_unsupported: 'Peramban ini tidak dapat membagikan berkas ' +
                            'langsung. Gunakan "Simpan ke Files", lalu ' +
                            'lampirkan di WhatsApp.',
      st_downloaded: 'Tersimpan ke Files, dan ditandai sudah terkirim.',
      file_meta: '%1$s  ·  %2$s MB  ·  %3$d baris',
      clear_none: 'Belum ada yang terkirim — tidak ada yang dihapus',
      clear_confirm: 'Hapus %1$d rekaman yang sudah terkirim beserta fotonya?\n\n' +
                     'Yang belum terkirim tetap disimpan. Lakukan ini hanya ' +
                     'setelah Excel benar-benar sampai di grup.',
      cleared: '%1$d dihapus',
      nothing_to_export: 'Tidak ada yang bisa diekspor',
      backfilled: '%1$d alamat terisi'
    }
  };

  var current = 'en';

  /** Fills %1$s / %2$d placeholders, keeping the Android string format. */
  function format(template, args) {
    return template.replace(/%(\d+)\$[sd]/g, function (whole, position) {
      var value = args[Number(position) - 1];
      return value === undefined ? whole : String(value);
    });
  }

  ARROW.i18n = {

    LANGUAGES: ['en', 'id'],

    current: function () { return current; },

    /** Falls back to English rather than showing a bare key. */
    t: function (key) {
      var table = STRINGS[current] || STRINGS.en;
      var template = table[key];
      if (template === undefined) template = STRINGS.en[key];
      if (template === undefined) return key;
      return format(template, Array.prototype.slice.call(arguments, 1));
    },

    /** What the phone is already set to, before anyone picks. */
    detect: function () {
      var tag = (navigator.language || 'en').toLowerCase();
      // An Indonesian iPhone reports "id-ID"; Android's legacy "in" is
      // accepted too in case a stored value ever came from there.
      return (tag.indexOf('id') === 0 || tag.indexOf('in') === 0) ? 'id' : 'en';
    },

    set: function (language) {
      current = STRINGS[language] ? language : 'en';
      document.documentElement.setAttribute('lang', current);
      return ARROW.i18n.apply();
    },

    /**
     * Translates the fixed text in the markup.
     *
     * Anything built at runtime calls t() directly instead — this only covers
     * what is written in index.html.
     */
    apply: function () {
      var t = ARROW.i18n.t;
      Array.prototype.forEach.call(
        document.querySelectorAll('[data-i18n]'),
        function (node) { node.textContent = t(node.getAttribute('data-i18n')); }
      );
      Array.prototype.forEach.call(
        document.querySelectorAll('[data-i18n-placeholder]'),
        function (node) {
          node.setAttribute('placeholder', t(node.getAttribute('data-i18n-placeholder')));
        }
      );
      return current;
    }
  };
}(window.ARROW));

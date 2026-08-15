/* ARROW PWA — screen wiring.
 *
 * The capture order is the Android app's: fill the form, take the photo, review
 * it, save. Zone, Segment and KP survive a save because consecutive assets are
 * usually on the same stretch, and re-picking them a few hundred times a day is
 * how mistakes get made. */

(function (ARROW) {

  var state = {
    operator: '',
    gps: { state: 'waiting' },
    form: { zone: '', segment: '', assetType: '', condition: '', kp: '', note: '' },
    review: null,
    built: null,         // { blob, filename, ids } once the Excel has been made
    chosen: [],          // the records the next build will cover
    includeSent: false   // re-include assets already handed to WhatsApp
  };

  /* Consecutive assets sit metres apart, and OpenStreetMap returns the same
     answer for both. Caching on a rounded fix (4 dp, about 11 m) turns a whole
     stretch into one lookup instead of forty. */
  var addressCache = {};

  function $(id) { return document.getElementById(id); }

  function t() { return ARROW.i18n.t.apply(null, arguments); }

  var currentScreen = 'setup';

  function show(screenId) {
    currentScreen = screenId;
    ['setup', 'form', 'review', 'list', 'export'].forEach(function (name) {
      $('screen-' + name).classList.toggle('active', name === screenId);
    });
    window.scrollTo(0, 0);
  }

  /* ── Language ───────────────────────────────────────────────────────── */

  function buildLangPicker(container) {
    container.innerHTML = '';
    ARROW.i18n.LANGUAGES.forEach(function (code) {
      var button = document.createElement('button');
      button.type = 'button';
      button.textContent = code.toUpperCase();
      button.setAttribute('data-lang', code);
      button.addEventListener('click', function () {
        if (code === ARROW.i18n.current()) return;
        ARROW.db.setPref('language', code);
        applyLanguage(code);
      });
      container.appendChild(button);
    });
  }

  function markLangPickers() {
    Array.prototype.forEach.call(
      document.querySelectorAll('.lang button'),
      function (button) {
        button.setAttribute('aria-pressed',
          String(button.getAttribute('data-lang') === ARROW.i18n.current()));
      }
    );
  }

  /**
   * Switches language and redraws everything.
   *
   * The markup is handled by data-i18n, but anything built at runtime — the
   * dropdown placeholders, the counter, the GPS panel, whichever list is on
   * screen — has to be regenerated, or half the interface stays in the old
   * language until the next action happens to rewrite it.
   */
  function applyLanguage(language) {
    ARROW.i18n.set(language);
    markLangPickers();

    if ($('f-zone').options.length) $('f-zone').options[0].textContent = t('select_zone');
    if ($('f-type').options.length) $('f-type').options[0].textContent = t('select_type');
    if ($('f-segment').options.length) {
      $('f-segment').options[0].textContent =
        state.form.zone ? t('select_segment') : t('select_zone_first');
    }

    renderGps();
    refreshCount();
    if (currentScreen === 'list') renderList();
    if (currentScreen === 'export') renderExport();
    if (currentScreen === 'review' && state.review) renderReview();
  }

  var toastTimer;
  function toast(message) {
    var element = $('toast');
    element.textContent = message;
    element.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { element.classList.remove('show'); }, 2600);
  }

  /* ── Setup ──────────────────────────────────────────────────────────── */

  $('setup-name').addEventListener('input', function () {
    $('setup-save').disabled = !this.value.trim();
  });

  $('setup-save').addEventListener('click', function () {
    var name = $('setup-name').value.trim();
    if (!name) return;
    state.operator = name;
    ARROW.db.setPref('operator', name).then(function () {
      $('operator-label').textContent = name;
      show('form');
      refreshCount();
    });
  });

  $('change-operator').addEventListener('click', function () {
    $('setup-name').value = state.operator;
    $('setup-save').disabled = false;
    show('setup');
  });

  /* ── Form ───────────────────────────────────────────────────────────── */

  function fillSelect(select, values, placeholder) {
    select.innerHTML = '<option value="">' + placeholder + '</option>';
    values.forEach(function (value) {
      var option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
  }

  function buildForm() {
    fillSelect($('f-zone'), ARROW.OPTIONS.zones, t('select_zone'));
    fillSelect($('f-type'), ARROW.OPTIONS.assetTypes, t('select_type'));
    fillSelect($('f-segment'), [], t('select_zone_first'));

    var chips = $('f-condition');
    ARROW.OPTIONS.conditions.forEach(function (condition) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.textContent = condition;
      chip.setAttribute('aria-pressed', 'false');
      chip.addEventListener('click', function () {
        state.form.condition = condition;
        Array.prototype.forEach.call(chips.children, function (other) {
          other.setAttribute('aria-pressed', String(other === chip));
        });
        updateReady();
      });
      chips.appendChild(chip);
    });
  }

  $('f-zone').addEventListener('change', function () {
    state.form.zone = this.value;
    var segments = ARROW.OPTIONS.segmentsByZone[this.value] || [];
    fillSelect($('f-segment'), segments,
      segments.length ? t('select_segment') : t('select_zone_first'));
    state.form.segment = '';
    updateReady();
  });

  $('f-segment').addEventListener('change', function () {
    state.form.segment = this.value;
    updateReady();
  });

  $('f-type').addEventListener('change', function () {
    state.form.assetType = this.value;
    updateReady();
  });

  /* The "+" is inserted as you type, so the caret has to be forced back to the
     end — otherwise typing 0,0,1,0,0 gives 00+001 rather than 00+100, a wrong
     location that looks entirely valid. Android hit exactly this. */
  $('f-kp').addEventListener('input', function () {
    var formatted = ARROW.formatKp(this.value);
    this.value = formatted;
    this.setSelectionRange(formatted.length, formatted.length);
    state.form.kp = formatted;
    updateReady();
  });

  $('f-note').addEventListener('input', function () {
    state.form.note = this.value;
  });

  function formComplete() {
    var form = state.form;
    return !!(form.zone && form.segment && form.assetType && form.condition &&
              ARROW.isKpComplete(form.kp));
  }

  function updateReady() {
    $('take-photo').disabled = !(formComplete() && state.gps.state === 'ok');
  }

  /* ── GPS ────────────────────────────────────────────────────────────── */

  function renderGps() {
    var panel = $('gps');
    var status = $('gps-status');
    var detail = $('gps-detail');
    var gps = state.gps;

    panel.className = 'gps ' + (gps.state === 'ok' ? 'ok' : gps.state === 'denied' ? 'denied' : 'waiting');

    if (gps.state === 'ok') {
      status.textContent = t('gps_locked', Math.round(gps.accuracy));
      detail.textContent = gps.latitude.toFixed(6) + ', ' + gps.longitude.toFixed(6);
    } else {
      status.textContent = gps.state === 'denied' ? t('gps_denied')
        : gps.state === 'unsupported' ? t('gps_unsupported')
        : t('gps_waiting');
      detail.textContent = gps.state === 'denied'
        ? t('gps_hint_settings')
        : t('gps_hint_open');
    }
    updateReady();
  }

  /* ── Capture ────────────────────────────────────────────────────────── */

  $('take-photo').addEventListener('click', function () {
    if (this.disabled) return;
    $('camera-input').click();
  });

  /** The address for a fix — from cache, or looked up with a short deadline. */
  function addressFor(latitude, longitude) {
    var key = latitude.toFixed(4) + ',' + longitude.toFixed(4);
    if (addressCache[key]) return Promise.resolve(addressCache[key]);
    if (!navigator.onLine) return Promise.resolve(null);

    // Capped well below the network timeout: the operator is standing in front
    // of the asset waiting for the review screen, and the four address columns
    // can be filled in later. The coordinates cannot.
    return Promise.race([
      ARROW.geo.reverse(latitude, longitude),
      new Promise(function (resolve) { setTimeout(function () { resolve(null); }, 5000); })
    ]).then(function (address) {
      if (address) addressCache[key] = address;
      return address;
    });
  }

  $('camera-input').addEventListener('change', function () {
    var file = this.files && this.files[0];
    this.value = '';                       // so retaking the same shot re-fires
    if (!file) return;

    var gps = state.gps;
    if (gps.state !== 'ok') { toast(t('lost_gps')); return; }

    var captured = new Date();
    var form = state.form;
    toast(t('processing_photo'));

    addressFor(gps.latitude, gps.longitude).then(function (address) {
      var meta = {
        segment: form.segment,
        kp: form.kp,
        assetType: form.assetType,
        condition: form.condition,
        timestamp: ARROW.timestampOf(captured),
        latitude: gps.latitude,
        longitude: gps.longitude,
        addressText: ARROW.geo.addressText(address)
      };

      return ARROW.photo.process(file, meta).then(function (processed) {
        state.review = {
          processed: processed,
          captured: captured,
          address: address,
          latitude: gps.latitude,
          longitude: gps.longitude,
          accuracy: gps.accuracy,
          form: Object.assign({}, form)
        };
        renderReview();
        show('review');
      });
    }).catch(function (error) {
      toast(error.message || t('photo_failed'));
    });
  });

  function renderReview() {
    var review = state.review;
    var image = $('review-photo');
    if (image.dataset.url) URL.revokeObjectURL(image.dataset.url);
    var url = URL.createObjectURL(review.processed.blob);
    image.dataset.url = url;
    image.src = url;

    var address = ARROW.geo.addressText(review.address);
    // The values stay as they are — asset type and condition are data, and go
    // into the spreadsheet exactly as shown here.
    var rows = [
      [t('sum_segment'), ARROW.Legacy.segment(review.form.segment)],
      [t('sum_type'), review.form.assetType],
      [t('sum_condition'), review.form.condition],
      [t('sum_kp'), ARROW.Legacy.kp(review.form.kp)],
      [t('sum_position'), review.latitude.toFixed(6) + ', ' + review.longitude.toFixed(6) +
                          '  (±' + Math.round(review.accuracy) + ' m)'],
      [t('sum_address'), address || t('address_later')],
      [t('sum_size'), Math.round(review.processed.blob.size / 1024) + ' KB']
    ];
    if (review.form.note) rows.push([t('sum_note'), review.form.note]);

    $('review-summary').innerHTML = rows.map(function (row) {
      return '<dt>' + row[0] + '</dt><dd></dd>';
    }).join('');
    // Values are set as text, never as HTML — a note is operator input.
    var values = $('review-summary').querySelectorAll('dd');
    rows.forEach(function (row, index) { values[index].textContent = row[1]; });
  }

  $('review-retake').addEventListener('click', function () {
    $('camera-input').click();
  });

  $('review-discard').addEventListener('click', function () {
    state.review = null;
    show('form');
  });

  $('review-save').addEventListener('click', function () {
    var review = state.review;
    if (!review) return;
    var button = this;
    button.disabled = true;

    var record = {
      date: ARROW.dateOf(review.captured),
      timestamp: ARROW.timestampOf(review.captured),
      operator: state.operator,
      zone: review.form.zone,
      segment: review.form.segment,
      assetType: review.form.assetType,
      condition: review.form.condition,
      kp: review.form.kp,
      note: review.form.note || '',
      latitude: review.latitude,
      longitude: review.longitude,
      accuracy: review.accuracy,
      street: review.address ? review.address.street : '',
      subDistrict: review.address ? review.address.subDistrict : '',
      district: review.address ? review.address.district : '',
      regency: review.address ? review.address.regency : '',
      // "pending" is what the backfill looks for. An address that came back
      // genuinely empty is "done" — asked, and there is no name for that spot.
      addressStatus: review.address ? 'done' : 'pending',
      photo: review.processed.blob,
      thumb: review.processed.thumb
    };

    ARROW.db.add(record).then(function () {
      state.review = null;
      // Zone, Segment and KP deliberately stay.
      state.form.assetType = '';
      state.form.condition = '';
      state.form.note = '';
      $('f-type').value = '';
      $('f-note').value = '';
      Array.prototype.forEach.call($('f-condition').children, function (chip) {
        chip.setAttribute('aria-pressed', 'false');
      });
      updateReady();
      button.disabled = false;
      show('form');
      refreshCount();
      toast(t('saved'));
    }).catch(function (error) {
      button.disabled = false;
      toast(t('save_failed', error.message));
    });
  });

  /* ── Counts and list ────────────────────────────────────────────────── */

  function refreshCount() {
    return ARROW.db.all().then(function (records) {
      var today = ARROW.dateOf(new Date());
      var todayCount = records.filter(function (r) { return r.date === today; }).length;
      var older = records.length - todayCount;
      var waiting = records.filter(function (r) { return !r.exportedAt; }).length;

      $('today-count').textContent =
        (todayCount === 0 ? t('count_none') : t('count_today', todayCount)) +
        (older > 0 ? ' · ' + t('count_older', older) : '') +
        (waiting !== records.length ? ' · ' + t('count_unsent', waiting) : '');

      $('go-export').disabled = records.length === 0;
      // Counts what would actually go, so a second run doesn't read as if it
      // were about to re-send the whole day.
      $('go-export').textContent = waiting
        ? t('go_export_n', waiting)
        : t('go_export');
      return records;
    });
  }

  $('view-list').addEventListener('click', function () { renderList(); show('list'); });
  $('list-back').addEventListener('click', function () { show('form'); });

  var listUrls = [];
  function renderList() {
    listUrls.forEach(URL.revokeObjectURL);
    listUrls = [];

    ARROW.db.all().then(function (records) {
      var body = $('list-body');
      body.innerHTML = '';
      $('list-title').textContent = t('list_title', records.length);

      if (!records.length) {
        var empty = document.createElement('p');
        empty.className = 'empty';
        empty.textContent = t('nothing_recorded');
        body.appendChild(empty);
        return;
      }

      records.slice().reverse().forEach(function (record) {
        var card = document.createElement('div');
        card.className = 'card';

        var image = document.createElement('img');
        if (record.thumb) {
          var url = URL.createObjectURL(record.thumb);
          listUrls.push(url);
          image.src = url;
        }
        image.alt = '';
        card.appendChild(image);

        var body2 = document.createElement('div');
        body2.className = 'card-body';
        var title = document.createElement('b');
        title.textContent = record.assetType + ' · ' + record.condition;
        var meta = document.createElement('div');
        meta.className = 'meta';
        meta.textContent = ARROW.Legacy.segment(record.segment) + '  ' +
          ARROW.Legacy.kp(record.kp) + '  ·  ' + record.timestamp;
        var addr = document.createElement('div');
        addr.className = 'addr';
        addr.textContent = ARROW.geo.addressText(record) ||
          (record.addressStatus === 'pending' ? t('address_pending') : '');
        body2.appendChild(title);
        body2.appendChild(meta);
        body2.appendChild(addr);
        card.appendChild(body2);

        var remove = document.createElement('button');
        remove.className = 'danger-link';
        remove.textContent = t('delete');
        remove.addEventListener('click', function () {
          if (!confirm(t('delete_confirm', record.assetType))) return;
          ARROW.db.remove(record.id).then(function () {
            renderList();
            refreshCount();
            toast(t('deleted'));
          });
        });
        card.appendChild(remove);

        body.appendChild(card);
      });
    });
  }

  /* ── Export ─────────────────────────────────────────────────────────── */

  $('go-export').addEventListener('click', function () { openExport(); });
  $('export-back').addEventListener('click', function () { show('form'); refreshCount(); });

  function openExport() {
    state.built = null;
    state.includeSent = false;
    $('export-ready').classList.add('hidden');
    $('export-build').classList.remove('hidden');
    $('export-status').textContent = '';
    show('export');
    renderExport();
  }

  /**
   * Works out what the next file will contain.
   *
   * Assets already handed to WhatsApp are left out by default. Sending twice
   * in a day is normal — a stretch finished before lunch, another after — and
   * without this the second file would repeat the first, so the office would
   * have to find and drop the duplicate rows.
   */
  function renderExport() {
    return ARROW.db.all().then(function (all) {
      var fresh = all.filter(function (record) { return !record.exportedAt; });
      var sentCount = all.length - fresh.length;
      var chosen = state.includeSent ? all : fresh;
      state.chosen = chosen;

      var dates = [];
      chosen.forEach(function (record) {
        if (dates.indexOf(record.date) === -1) dates.push(record.date);
      });
      dates.sort();

      $('export-summary').textContent = chosen.length === 0
        ? (sentCount > 0 ? t('export_nothing_new') : t('export_nothing'))
        : (dates.length === 1
            ? t('export_count_day', chosen.length, dates[0])
            : t('export_count_days', chosen.length, dates.length, dates.join(', ')));

      var include = $('export-include');
      if (sentCount > 0) {
        include.classList.remove('hidden');
        include.textContent = state.includeSent
          ? t('include_remove', sentCount)
          : t('include_add', sentCount);
      } else {
        include.classList.add('hidden');
      }

      $('export-build').disabled = chosen.length === 0;

      var pending = chosen.filter(function (r) { return r.addressStatus === 'pending'; }).length;
      var notice = $('export-address');
      if (pending > 0) {
        notice.classList.remove('hidden');
        notice.textContent = navigator.onLine
          ? t('addr_online', pending)
          : t('addr_offline', pending);
      } else {
        notice.classList.add('hidden');
      }
    });
  }

  $('export-include').addEventListener('click', function () {
    state.includeSent = !state.includeSent;
    renderExport();
  });

  $('export-build').addEventListener('click', function () {
    var button = this;
    button.disabled = true;
    var status = $('export-status');

    var chosenIds = state.chosen.map(function (record) { return record.id; });
    status.textContent = t('st_addresses');

    // 45 seconds, then build with whatever came back. Getting the file out
    // matters more than four columns, and the rest stay pending for next time.
    ARROW.geo.backfill(function (done, total) {
      status.textContent = t('st_addresses_n', done, total);
    }, 45000).then(function () {
      return ARROW.db.all();
    }).then(function (all) {
      var records = all.filter(function (record) {
        return chosenIds.indexOf(record.id) !== -1;
      });
      if (!records.length) throw new Error(t('nothing_to_export'));
      status.textContent = t('st_building');
      return ARROW.xlsx.build(records, function (done, total) {
        status.textContent = t('st_photos', done, total);
      }).then(function (blob) {
        var latest = records[records.length - 1];
        var filename = 'ARROW_Assets_' + latest.date.replace(/-/g, '') + '_' +
          ARROW.fileSafe(state.operator) + '.xlsx';
        state.built = {
          blob: blob, filename: filename,
          count: records.length, ids: chosenIds
        };

        $('export-filename').textContent = t('file_meta',
          filename, (blob.size / 1048576).toFixed(1), records.length);
        $('export-ready').classList.remove('hidden');
        button.classList.add('hidden');
        status.textContent = t('st_ready',
          ARROW.xlsx.PHOTO_WIDTH_CM, ARROW.xlsx.PHOTO_HEIGHT_CM);
      });
    }).catch(function (error) {
      button.disabled = false;
      status.textContent = t('st_failed', error.message || error);
    });
  });

  /* Share runs straight off the tap with the file already in hand. Awaiting
     anything first costs the page its permission to open the iOS share sheet,
     and the sheet silently never appears — which is why building is a
     separate button. */
  $('export-share').addEventListener('click', function () {
    if (!state.built) return;
    var file = new File([state.built.blob], state.built.filename, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: state.built.filename })
        .then(function () {
          var count = state.built.count;
          return markSent().then(function () {
            $('export-status').textContent = t('st_sent', count);
          });
        })
        .catch(function (error) {
          // A cancelled share must not mark anything: nothing left the phone.
          if (error && error.name === 'AbortError') return;
          $('export-status').textContent = t('st_share_failed');
        });
    } else {
      $('export-status').textContent = t('st_share_unsupported');
    }
  });

  /** Stamps the batch that was just handed over. */
  function markSent() {
    if (!state.built) return Promise.resolve();
    return ARROW.db.markExported(state.built.ids, new Date().toISOString());
  }

  $('export-download').addEventListener('click', function () {
    if (!state.built) return;
    var url = URL.createObjectURL(state.built.blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = state.built.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
    markSent().then(function () {
      $('export-status').textContent = t('st_downloaded');
    });
  });

  /**
   * Frees storage, and deliberately only touches assets already handed over.
   *
   * An operator reaching for this mid-shift cannot destroy a capture that has
   * never left the phone — the same rule the Android app follows in refusing
   * to delete a photo it has no acknowledgement for.
   */
  $('export-clear').addEventListener('click', function () {
    ARROW.db.all().then(function (all) {
      var sent = all.filter(function (record) { return record.exportedAt; });
      if (!sent.length) {
        toast(t('clear_none'));
        return;
      }
      if (!confirm(t('clear_confirm', sent.length))) return;
      return ARROW.db.removeMany(sent.map(function (r) { return r.id; }))
        .then(function () {
          state.built = null;
          toast(t('cleared', sent.length));
          show('form');
          refreshCount();
        });
    });
  });

  /* ── Start-up ───────────────────────────────────────────────────────── */

  function init() {
    buildLangPicker($('lang-form'));
    buildLangPicker($('lang-setup'));

    /* Language first, before anything draws — otherwise the form is built with
       English placeholders and only corrects itself on the next redraw.

       Before anyone picks, follow the phone: an Indonesian iPhone opens in
       Indonesian. Same rule as LanguagePrefs.current() on Android. */
    ARROW.db.getPref('language', '').then(function (stored) {
      ARROW.i18n.set(stored || ARROW.i18n.detect());
      markLangPickers();
      buildForm();
      renderGps();
      return ARROW.db.getPref('operator', '');
    }).then(function (name) {
      state.operator = name || '';
      if (state.operator) {
        $('operator-label').textContent = state.operator;
        show('form');
        refreshCount();
      } else {
        show('setup');
      }
    });

    ARROW.geo.watch(function (update) { state.gps = update; renderGps(); });

    // Without this, iOS treats the day's photos as ordinary cache and may
    // evict them under storage pressure.
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist();

    window.addEventListener('online', function () {
      ARROW.geo.backfill().then(function (filled) {
        if (filled > 0) toast(t('backfilled', filled));
      });
    });

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(function () {
        // Offline start-up won't work, but everything else still does.
      });
    }
  }

  document.addEventListener('DOMContentLoaded', init);
}(window.ARROW));

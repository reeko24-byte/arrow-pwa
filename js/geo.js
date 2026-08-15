/* GPS, and turning a fix into the four address columns.

   Android had a Geocoder built into the OS. A browser has nothing, so the
   address comes from OpenStreetMap's Nominatim when there is signal. With no
   signal the record is saved anyway, marked "pending", and filled in later —
   the coordinates are the part that must be right at capture time, and they
   never depend on the network. */

(function (ARROW) {
  var ENDPOINT = 'https://nominatim.openstreetmap.org/reverse';

  /* Nominatim's usage policy allows at most one request a second. A day is
     ~40 assets, so this is nowhere near the limit, but the backfill can fire
     a burst when signal returns and that is exactly what the policy forbids. */
  var MIN_GAP_MS = 1200;
  var lastCallAt = 0;

  var EMPTY = { street: '', subDistrict: '', district: '', regency: '' };

  function throttle() {
    var wait = Math.max(0, lastCallAt + MIN_GAP_MS - Date.now());
    lastCallAt = Date.now() + wait;
    return new Promise(function (resolve) { setTimeout(resolve, wait); });
  }

  /**
   * Maps Nominatim's address object onto the report's four columns.
   *
   * Indonesian administrative levels land in different Nominatim keys
   * depending on how the area was tagged in OSM, so each column takes the
   * first key that has anything in it:
   *
   *   Street       road            Jalan ...
   *   Sub-District village/suburb  desa / kelurahan   (admin_level 8)
   *   District     city_district   kecamatan          (admin_level 7)
   *   Regency      county          kabupaten / kota   (admin_level 6)
   */
  /* OpenStreetMap returns the bare name — "Bathin Solapan", "Bengkalis" —
     while the report writes "Kecamatan Bathin Solapan" and "Kabupaten
     Bengkalis". Add the level's title unless the name already carries one. */
  function titled(value, title) {
    if (!value) return '';
    /* Some Indonesian areas are tagged in OSM with an English suffix
       ("Kampar Regency", "Dumai City"). Left alone that becomes
       "Kabupaten Kampar Regency", so drop it before adding the title. */
    var name = String(value).replace(/\s+(Regency|City|District|Subdistrict)$/i, '').trim();
    return /^(kecamatan|kabupaten|kota|kelurahan|desa|distrik)\b/i.test(name)
      ? name
      : title + ' ' + name;
  }

  function mapAddress(address) {
    if (!address) return Object.assign({}, EMPTY);

    function first() {
      for (var i = 0; i < arguments.length; i++) {
        var value = address[arguments[i]];
        if (value) return String(value);
      }
      return '';
    }

    /* A kota is a city-level regency, not a kabupaten, so which key matched
       decides the title. */
    var regency = address.county
      ? titled(String(address.county), 'Kabupaten')
      : address.city
        ? titled(String(address.city), 'Kota')
        : first('state_district');

    return {
      street: first('road', 'pedestrian', 'footway'),
      subDistrict: titled(first('village', 'suburb', 'hamlet', 'neighbourhood', 'quarter'),
                          'Desa'),
      district: titled(first('city_district', 'municipality', 'subdistrict', 'town'),
                       'Kecamatan'),
      regency: regency
    };
  }

  ARROW.geo = {

    /** Nothing was ever looked up for this record. */
    EMPTY: EMPTY,

    /**
     * Starts a continuous fix. Reports every update to onUpdate, including
     * failures, so the form can enable or disable the camera accordingly.
     */
    watch: function (onUpdate) {
      /* Reports a state, never a sentence — the wording belongs to the screen,
         which is the only part that knows which language is showing. */
      if (!navigator.geolocation) {
        onUpdate({ state: 'unsupported' });
        return function () {};
      }
      var id = navigator.geolocation.watchPosition(
        function (position) {
          onUpdate({
            state: 'ok',
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
        },
        function (error) {
          onUpdate({
            state: error.code === error.PERMISSION_DENIED ? 'denied' : 'waiting'
          });
        },
        // maximumAge 0 because a cached fix from the previous asset would be
        // attached to this one, hundreds of metres away.
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
      );
      return function () { navigator.geolocation.clearWatch(id); };
    },

    /**
     * Resolves to the four address fields, or null when the lookup could not
     * be made. Null means "try again later"; an object with empty strings
     * means "asked, and OpenStreetMap has no name for this spot".
     */
    reverse: function (latitude, longitude) {
      if (!navigator.onLine) return Promise.resolve(null);
      return throttle().then(function () {
        var url = ENDPOINT +
          '?format=jsonv2&addressdetails=1&zoom=18' +
          '&lat=' + encodeURIComponent(latitude) +
          '&lon=' + encodeURIComponent(longitude);
        // The route has poor signal; without a deadline a request can hang
        // for minutes and the operator is left staring at a spinner.
        var controller = new AbortController();
        var timer = setTimeout(function () { controller.abort(); }, 12000);
        return fetch(url, {
          signal: controller.signal,
          headers: { 'Accept': 'application/json' }
        })
          .then(function (response) {
            if (!response.ok) throw new Error('HTTP ' + response.status);
            return response.json();
          })
          .then(function (data) { return mapAddress(data && data.address); })
          .catch(function () { return null; })
          .then(function (result) { clearTimeout(timer); return result; });
      });
    },

    /** The single line burned into the photo, matching the Android overlay. */
    addressText: function (address) {
      if (!address) return '';
      return [address.street, address.subDistrict, address.district, address.regency]
        .filter(function (part) { return part && part.trim(); })
        .join(', ');
    },

    /**
     * Fills in every record still waiting on an address.
     *
     * Called when the connection returns and again before an export, so the
     * spreadsheet leaves with as much filled in as the day allowed.
     * onProgress(done, total) drives the export screen's message.
     */
    backfill: function (onProgress, deadlineMs) {
      /* A deadline, because "online" on iOS only means there is a network
         interface, not that anything gets through it. On a weak signal every
         lookup runs to its 12 second timeout, and forty of them would leave
         the operator watching a spinner for nine minutes before the workbook
         even starts building. Better to fill in what the signal allows and
         get the file out; whatever is left stays pending for next time. */
      var stopAt = deadlineMs ? Date.now() + deadlineMs : Infinity;

      return ARROW.db.awaitingAddress().then(function (pending) {
        if (!pending.length || !navigator.onLine) return 0;
        var filled = 0;
        // Sequential on purpose — the throttle is per request, and a burst is
        // what gets a client blocked.
        return pending.reduce(function (chain, record, index) {
          return chain.then(function () {
            if (Date.now() >= stopAt || record.latitude == null) return null;
            if (onProgress) onProgress(index, pending.length);
            return ARROW.geo.reverse(record.latitude, record.longitude)
              .then(function (address) {
                if (!address) return null;
                Object.assign(record, address);
                record.addressStatus = 'done';
                filled++;
                return ARROW.db.put(record);
              });
          });
        }, Promise.resolve()).then(function () {
          if (onProgress) onProgress(pending.length, pending.length);
          return filled;
        });
      });
    }
  };
}(window.ARROW));

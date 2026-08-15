/* IndexedDB — the day's records, photos included.

   Photos are stored as Blobs on the record itself rather than in a separate
   store. A day is ~40 assets at ~250 KB, so the whole thing is under 15 MB,
   and keeping them together means a delete can never orphan a photo. */

(function (ARROW) {
  var DB_NAME = 'arrow-pwa';
  var DB_VERSION = 1;
  var RECORDS = 'records';
  var PREFS = 'prefs';

  var dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      var request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = function (event) {
        var db = event.target.result;
        if (!db.objectStoreNames.contains(RECORDS)) {
          var store = db.createObjectStore(RECORDS, { keyPath: 'id', autoIncrement: true });
          store.createIndex('byDate', 'date', { unique: false });
          // Everything still waiting on a reverse-geocode lookup, so the
          // backfill can find them without walking every record.
          store.createIndex('byAddressStatus', 'addressStatus', { unique: false });
        }
        if (!db.objectStoreNames.contains(PREFS)) {
          db.createObjectStore(PREFS, { keyPath: 'key' });
        }
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });
    return dbPromise;
  }

  function tx(storeName, mode, work) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var transaction = db.transaction(storeName, mode);
        var store = transaction.objectStore(storeName);
        var result;
        // Resolve on transaction completion, not on the request's success:
        // a write is only durable once the transaction commits.
        transaction.oncomplete = function () { resolve(result); };
        transaction.onerror = function () { reject(transaction.error); };
        transaction.onabort = function () { reject(transaction.error); };
        result = work(store, function (value) { result = value; });
      });
    });
  }

  function requestValue(request, set) {
    request.onsuccess = function () { set(request.result); };
    return undefined;
  }

  ARROW.db = {

    /** Adds a record and returns it with the assigned id. */
    add: function (record) {
      return tx(RECORDS, 'readwrite', function (store, set) {
        var request = store.add(record);
        request.onsuccess = function () {
          record.id = request.result;
          set(record);
        };
      });
    },

    put: function (record) {
      return tx(RECORDS, 'readwrite', function (store, set) {
        return requestValue(store.put(record), set);
      });
    },

    get: function (id) {
      return tx(RECORDS, 'readonly', function (store, set) {
        return requestValue(store.get(id), set);
      });
    },

    remove: function (id) {
      return tx(RECORDS, 'readwrite', function (store, set) {
        return requestValue(store.delete(id), set);
      });
    },

    /** Every record for one "YYYY-MM-DD", oldest first — capture order. */
    byDate: function (date) {
      return tx(RECORDS, 'readonly', function (store, set) {
        var request = store.index('byDate').getAll(date);
        request.onsuccess = function () {
          set(request.result.sort(function (a, b) { return a.id - b.id; }));
        };
      });
    },

    all: function () {
      return tx(RECORDS, 'readonly', function (store, set) {
        return requestValue(store.getAll(), set);
      });
    },

    /** Records whose address never came back — the backfill queue. */
    awaitingAddress: function () {
      return tx(RECORDS, 'readonly', function (store, set) {
        return requestValue(store.index('byAddressStatus').getAll('pending'), set);
      });
    },

    removeMany: function (ids) {
      return tx(RECORDS, 'readwrite', function (store) {
        ids.forEach(function (id) { store.delete(id); });
      });
    },

    /**
     * Stamps records as handed to the share sheet.
     *
     * Deliberately a mark rather than a delete: a WhatsApp share is not proof
     * of delivery, so the photos stay on the phone. What this buys is that the
     * next export knows which assets have already gone, instead of sending the
     * whole day again every time.
     *
     * Already-stamped records keep their original stamp, so re-sending a batch
     * doesn't rewrite when it first left.
     */
    markExported: function (ids, stamp) {
      return tx(RECORDS, 'readwrite', function (store) {
        ids.forEach(function (id) {
          var request = store.get(id);
          request.onsuccess = function () {
            var record = request.result;
            if (record && !record.exportedAt) {
              record.exportedAt = stamp;
              store.put(record);
            }
          };
        });
      });
    },

    getPref: function (key, fallback) {
      return tx(PREFS, 'readonly', function (store, set) {
        var request = store.get(key);
        request.onsuccess = function () {
          set(request.result ? request.result.value : fallback);
        };
      });
    },

    setPref: function (key, value) {
      return tx(PREFS, 'readwrite', function (store, set) {
        return requestValue(store.put({ key: key, value: value }), set);
      });
    }
  };
}(window.ARROW));

mergeInto(LibraryManager.library, {
  HexrotaStorageContains: function(key) {
    try {
      if (!window.hexrotaProfileLock) return -1;
      return localStorage.getItem('hexrota-unity-9.11/' + UTF8ToString(key)) === null ? 0 : 1;
    } catch (e) { return -1; }
  },
  HexrotaStorageRead: function(key) {
    try {
      if (!window.hexrotaProfileLock) return 0;
      var json = localStorage.getItem('hexrota-unity-9.11/' + UTF8ToString(key));
      // Empty string represents missing only. Malformed nonempty JSON is rejected by C#.
      if (json === '') return 0;
      return stringToNewUTF8(json === null ? '' : json);
    } catch (e) { return 0; }
  },
  HexrotaStorageWrite: function(key, json) {
    try {
      if (!window.hexrotaProfileLock) return -1;
      localStorage.setItem('hexrota-unity-9.11/' + UTF8ToString(key), UTF8ToString(json));
      return 1;
    } catch (e) { return -1; }
  },
  HexrotaStorageCas: function(key, revision, json) {
    try {
      if (!window.hexrotaProfileLock) return -1;
      var name = 'hexrota-unity-9.11/' + UTF8ToString(key);
      var raw = localStorage.getItem(name), actual = 0;
      if (raw !== null) {
        var previous = JSON.parse(raw);
        if (!previous || previous.schemaVersion !== 2 || !Number.isSafeInteger(previous.revision) || previous.revision < 1 || !previous.game || !previous.energy) return -1;
        actual = previous.revision;
      }
      if (actual !== revision) return 0;
      var next = JSON.parse(UTF8ToString(json));
      if (next.schemaVersion !== 2 || next.revision !== revision + 1 || !Number.isSafeInteger(next.revision) || !next.game || !next.energy) return -1;
      localStorage.setItem(name, UTF8ToString(json));
      return 1;
    } catch (e) { return -1; }
  }
});

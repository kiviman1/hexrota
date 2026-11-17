using System;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;
using Hexrota.Gameplay;

namespace Hexrota.Client
{
    // First Unity playable vertical slice. UI/3D presentation never computes game rules.
    // Later campaign, animation and save adapters will own their own lifecycles.
    public sealed class HexrotaBoardController : MonoBehaviour
    {
        private const int MaxLevel = 10;
        private int levelId = 1;
        private int variantIndex;
        private int selected = -1;
        private int lastWidth = -1, lastHeight = -1;
        private HexrotaLevelData document;
        private HexMatch game;
        private HexrotaTileView[] tiles;
        private GameObject boardRoot;
        private Camera boardCamera;
        private Text titleText, progressText, messageText;
        private Font uiFont;
        private string message = "Komşu iki taşı seç. Aynı sayıdan en az üçü eşleşsin.";
        private HexrotaTheme theme;

        private void Awake()
        {
            Application.targetFrameRate = 60;
            theme = Resources.Load<HexrotaTheme>("Hexrota/Theme");
            CreateCamera();
            CreateHud();
            LoadLevel(1, 0);
        }

        private void Update()
        {
            if (game == null) return;
            if (lastWidth != Screen.width || lastHeight != Screen.height) FrameBoard();
            if (game.Status != "playing") return;
            if (Input.touchCount > 0)
            {
                for (int i = 0; i < Input.touchCount; i++)
                {
                    Touch touch = Input.GetTouch(i);
                    if (touch.phase == TouchPhase.Began) SelectAt(touch.position);
                }
            }
            else if (Input.GetMouseButtonDown(0)) SelectAt(Input.mousePosition);
        }

        private void CreateCamera()
        {
            var obj = new GameObject("Hexrota Board Camera");
            obj.transform.SetParent(transform, false);
            boardCamera = obj.AddComponent<Camera>();
            boardCamera.orthographic = true;
            boardCamera.clearFlags = CameraClearFlags.SolidColor;
            boardCamera.backgroundColor = new Color(0.11f, 0.16f, 0.21f);
            boardCamera.rect = new Rect(0f, 0.18f, 1f, 0.66f);
            boardCamera.nearClipPlane = 0.1f;
            boardCamera.farClipPlane = 100f;
            obj.AddComponent<AudioListener>();
        }

        private void CreateHud()
        {
            uiFont = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            if (uiFont == null) uiFont = Font.CreateDynamicFontFromOSFont("Arial", 32);
            var obj = new GameObject("Hexrota HUD", typeof(RectTransform), typeof(Canvas),
                typeof(CanvasScaler), typeof(GraphicRaycaster));
            obj.transform.SetParent(transform, false);
            Canvas canvas = obj.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            CanvasScaler scaler = obj.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(390, 844);
            scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.MatchWidthOrHeight;
            scaler.matchWidthOrHeight = 0.5f;

            RectTransform header = Panel("Header", obj.transform, new Color(0.10f, 0.19f, 0.24f),
                new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0f, 146f),
                new Vector2(0f, 0f), new Vector2(0.5f, 1f));
            titleText = Label("Title", header, new Vector2(0f, 40f), new Vector2(360f, 44f),
                26, TextAnchor.MiddleCenter);
            progressText = Label("Progress", header, new Vector2(0f, -15f), new Vector2(360f, 48f),
                17, TextAnchor.MiddleCenter);

            RectTransform footer = Panel("Footer", obj.transform, new Color(0.10f, 0.19f, 0.24f),
                new Vector2(0f, 0f), new Vector2(1f, 0f), new Vector2(0f, 160f),
                new Vector2(0f, 0f), new Vector2(0.5f, 0f));
            messageText = Label("Message", footer, new Vector2(0f, 35f), new Vector2(362f, 66f),
                14, TextAnchor.MiddleCenter);
            ButtonAt(footer, "Bölüm -", -135f, () => LoadLevel(Math.Max(1, levelId - 1), 0));
            ButtonAt(footer, "Yeniden", -45f, () => LoadLevel(levelId, variantIndex));
            ButtonAt(footer, "Varyant", 45f, NextVariant);
            ButtonAt(footer, "Bölüm +", 135f, () => LoadLevel(Math.Min(MaxLevel, levelId + 1), 0));

            if (UnityEngine.Object.FindFirstObjectByType<EventSystem>() == null)
            {
                var events = new GameObject("Hexrota UI Events", typeof(EventSystem),
                    typeof(StandaloneInputModule));
                events.transform.SetParent(transform, false);
            }
        }

        private static RectTransform Panel(string title, Transform parent, Color color,
            Vector2 min, Vector2 max, Vector2 size, Vector2 position, Vector2 pivot)
        {
            var obj = new GameObject(title, typeof(RectTransform), typeof(Image));
            obj.transform.SetParent(parent, false);
            RectTransform rect = obj.GetComponent<RectTransform>();
            rect.anchorMin = min; rect.anchorMax = max; rect.pivot = pivot;
            rect.sizeDelta = size; rect.anchoredPosition = position;
            obj.GetComponent<Image>().color = color;
            return rect;
        }

        private Text Label(string title, Transform parent, Vector2 position,
            Vector2 size, int fontSize, TextAnchor alignment)
        {
            var obj = new GameObject(title, typeof(RectTransform), typeof(Text));
            obj.transform.SetParent(parent, false);
            RectTransform rect = obj.GetComponent<RectTransform>();
            rect.anchorMin = rect.anchorMax = new Vector2(0.5f, 0.5f);
            rect.sizeDelta = size; rect.anchoredPosition = position;
            Text label = obj.GetComponent<Text>();
            label.font = uiFont; label.fontSize = fontSize; label.alignment = alignment;
            label.color = new Color(0.96f, 0.96f, 0.90f);
            label.horizontalOverflow = HorizontalWrapMode.Wrap;
            label.verticalOverflow = VerticalWrapMode.Overflow;
            return label;
        }

        private void ButtonAt(RectTransform parent, string title, float x, UnityEngine.Events.UnityAction action)
        {
            RectTransform rect = Panel(title, parent, new Color(0.24f, 0.43f, 0.39f),
                new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f),
                new Vector2(84f, 50f), new Vector2(x, -35f), new Vector2(0.5f, 0.5f));
            var button = rect.gameObject.AddComponent<Button>();
            button.targetGraphic = rect.GetComponent<Image>();
            button.onClick.AddListener(action);
            Label(title + " Text", rect, Vector2.zero, new Vector2(84f, 48f), 12, TextAnchor.MiddleCenter).text = title;
        }

        private void NextVariant()
        {
            if (document == null || document.variants == null || document.variants.Length == 0) return;
            LoadLevel(levelId, (variantIndex + 1) % document.variants.Length);
        }

        private void LoadLevel(int nextLevel, int nextVariant)
        {
            try
            {
                TextAsset asset = Resources.Load<TextAsset>("Hexrota/Levels/level-" + nextLevel);
                if (asset == null) throw new InvalidOperationException("Missing published Unity level " + nextLevel);
                HexrotaLevelData nextDocument = JsonUtility.FromJson<HexrotaLevelData>(asset.text);
                if (nextDocument == null || nextDocument.variants == null ||
                    nextVariant < 0 || nextVariant >= nextDocument.variants.Length)
                    throw new InvalidOperationException("Invalid published Unity level");
                LevelConfig config = nextDocument.Resolve(nextDocument.variants[nextVariant].id);
                HexMatch nextGame = new HexMatch(config);
                document = nextDocument; game = nextGame; levelId = nextLevel;
                variantIndex = nextVariant; selected = -1;
                message = "İki komşu taşı seç. Eşleşme için aynı sayıdan üç taş gerekiyor.";
                BuildBoard();
                Refresh();
            }
            catch (Exception error)
            {
                Debug.LogException(error);
                message = "Bölüm yüklenemedi. Unity Console'u kontrol et.";
                if (messageText != null) messageText.text = message;
            }
        }

        private void BuildBoard()
        {
            if (boardRoot != null) Destroy(boardRoot);
            boardRoot = new GameObject("Hexrota Board " + levelId);
            boardRoot.transform.SetParent(transform, false);
            tiles = new HexrotaTileView[game.level.cells.Length];
            for (int i = 0; i < tiles.Length; i++)
            {
                var tile = new GameObject("Tile " + i);
                tile.transform.SetParent(boardRoot.transform, false);
                tiles[i] = tile.AddComponent<HexrotaTileView>();
                tiles[i].Initialize(i, game.level.cells[i], theme);
            }
            FrameBoard();
        }

        private void FrameBoard()
        {
            lastWidth = Screen.width; lastHeight = Screen.height;
            if (game == null || boardCamera == null) return;
            float minX = float.MaxValue, maxX = float.MinValue;
            float minZ = float.MaxValue, maxZ = float.MinValue;
            foreach (Cell cell in game.level.cells)
            {
                float x = 1.08f * (cell.q + cell.r * 0.5f), z = 0.93f * cell.r;
                minX = Mathf.Min(minX, x); maxX = Mathf.Max(maxX, x);
                minZ = Mathf.Min(minZ, z); maxZ = Mathf.Max(maxZ, z);
            }
            float centreX = (minX + maxX) * 0.5f, centreZ = (minZ + maxZ) * 0.5f;
            boardCamera.transform.position = new Vector3(centreX, 10f, centreZ - 6f);
            boardCamera.transform.LookAt(new Vector3(centreX, 0f, centreZ));
            float aspect = (float)Mathf.Max(1, Screen.width) /
                Mathf.Max(1f, Screen.height * boardCamera.rect.height);
            float halfWidth = (maxX - minX + 1.5f) * 0.5f;
            float halfHeight = (maxZ - minZ + 1.6f) * 0.5f;
            boardCamera.orthographicSize = Mathf.Max(2.8f, halfHeight * 1.45f, halfWidth / aspect);
        }

        private void SelectAt(Vector2 screenPosition)
        {
            Ray ray = boardCamera.ScreenPointToRay(screenPosition);
            RaycastHit hit;
            if (!Physics.Raycast(ray, out hit, 100f)) return;
            HexrotaTileView tile = hit.collider.GetComponentInParent<HexrotaTileView>();
            if (tile == null || tiles == null || Array.IndexOf(tiles, tile) < 0) return;
            int index = tile.Index;
            if (selected < 0) { selected = index; message = "Şimdi komşu taşı seç."; Refresh(); return; }
            if (selected == index) { selected = -1; message = "Seçim kaldırıldı."; Refresh(); return; }
            if (!game.Adjacent(selected, index))
            {
                selected = index; message = "Yalnızca komşu taşlar yer değiştirebilir.";
                Refresh(); return;
            }
            SwapResult result = game.Swap(selected, index);
            selected = -1;
            message = result.ok ? result.frames.Length + " eşleşme dalgası · +" + result.scoreGain + " puan" :
                "Bu takas eşleşme oluşturmuyor.";
            if (game.Status == "won") message = "Bölüm tamamlandı! Sonraki bölümü deneyebilirsin.";
            else if (game.Status == "lost") message = "Hamlelerin bitti. Yeniden deneyebilirsin.";
            Refresh();
        }

        private void Refresh()
        {
            if (game == null || tiles == null) return;
            for (int i = 0; i < tiles.Length; i++)
                tiles[i].Refresh(game.values[i], game.layers[i], i == selected);
            titleText.text = "HEXROTA · Bölüm " + levelId + " · " + document.variants[variantIndex].id;
            progressText.text = "Puan " + game.score + " / " + game.level.target +
                "     Hamle " + game.movesLeft + "     Yeşil " + game.Covered + " / " + game.Total;
            messageText.text = message;
        }
    }
}

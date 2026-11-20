using System;
using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    // Shared by modal sheets, scrollable preferences and the chapter preview.
    public sealed class CastlePopupChrome : MonoBehaviour
    {
        internal enum Finish { Primary, Secondary, Danger, Inset }
        internal enum Art { Chest, Heart, Map, Gear, Coin, Reward }

        [SerializeField] private Text title;
        [SerializeField] private Button dismiss;
        [SerializeField] private CastleBevel primary, secondary, danger, inset;
        [SerializeField] private Sprite chest, heart, map, gear, coin, reward;
        [SerializeField] private CastlePopupIllustration illustrationTemplate;
        [SerializeField] private Color textColor = new Color32(255, 244, 215, 255);
        [SerializeField] private Color accentColor = new Color32(255, 222, 156, 255);
        /// <summary>The chest illustration from the popup prefab, reused as the HUD bag icon.</summary>
        internal static Sprite ChestIcon
        {
            get { var prefab = Resources.Load<GameObject>("CastleGame/CastlePopup"); var chrome = prefab == null ? null : prefab.GetComponent<CastlePopupChrome>(); return chrome == null ? null : chrome.chest; }
        }
        internal Color Paper => textColor;
        internal Color Gold => accentColor;

        internal static CastlePopupChrome Create(Transform parent, string name, string titleName, string text, Action close)
        {
            var prefab = Resources.Load<GameObject>("CastleGame/CastlePopup");
            var shell = Instantiate(prefab, parent, false).GetComponent<CastlePopupChrome>();
            shell.name = name;
            shell.title.name = titleName;
            shell.title.text = text;
            shell.dismiss.gameObject.SetActive(close != null);
            if (close != null) shell.dismiss.onClick.AddListener(() => close());
            return shell;
        }

        internal void PlaceContent(RectTransform content)
        {
            // Keep the title and close control above clipped/scrollable body content.
            content.SetSiblingIndex(title.transform.parent.GetSiblingIndex());
        }

        internal void Paint(GameObject target, Finish finish)
        {
            var source = finish == Finish.Primary ? primary : finish == Finish.Danger ? danger :
                finish == Finish.Inset ? inset : secondary;
            var flat = target.GetComponent<PhonePlate>();
            if (flat != null) flat.enabled = false;
            var bevel = target.GetComponent<CastleBevel>();
            if (bevel == null) bevel = target.AddComponent<CastleBevel>();
            bevel.CopyFinishFrom(source);
        }

        internal static void EmbossAction(Text label)
        {
            var shadow=label.gameObject.AddComponent<Outline>();
            shadow.effectColor=new Color32(44, 99, 33, 220);
            shadow.effectDistance=new Vector2(.9f,-1.2f);
        }

        internal void Illustrate(RectTransform area, Art art)
        {
            var field = area.gameObject.AddComponent<Image>();
            field.raycastTarget = false;
            Paint(area.gameObject, Finish.Inset);
            var subject = art == Art.Reward ? reward : art == Art.Chest ? chest : art == Art.Heart ? heart :
                art == Art.Map ? map : art == Art.Gear ? gear : coin;
            var illustration = Instantiate(illustrationTemplate,area,false);
            illustration.Bind(subject,art == Art.Reward);
        }
    }
}

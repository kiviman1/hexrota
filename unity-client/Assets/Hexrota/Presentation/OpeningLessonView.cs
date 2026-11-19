using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    public sealed class OpeningLessonView : MonoBehaviour
    {
        [SerializeField] private RectTransform prompt, hudWash;
        [SerializeField] private Text heading, copy;
        [Header("İlk takas")]
        [SerializeField] private string swapHeading = "Üç aynı sayıyı hizala";
        [SerializeField, TextArea] private string swapCopy = "{sayı} taşını ok yönünde kaydır.";
        [Header("Zemin hedefi")]
        [SerializeField] private string groundHeading = "Toprağı yeşert";
        [SerializeField, TextArea] private string groundCopy = "Eşleşen sayılar puan olur. Altlarındaki toprak yeşerir.";
        [Header("İkinci zemin katı")]
        [SerializeField] private string doubleGroundHeading = "Çift katlı zemin";
        [SerializeField, TextArea] private string doubleGroundCopy = "Aynı hücrede iki kez eşleşme yaparak iki katı da aç.";
        [Header("İlk kasalar")]
        [SerializeField] private string crateHeading = "Kasaların yolunu aç";
        [SerializeField, TextArea] private string crateCopy = "Kasanın yanında eşleştir. Kırılınca taşlar altındaki toprağa düşer.";
        [Header("Yeni sayı")]
        [SerializeField] private string fiveHeading = "5 taşı";
        [SerializeField, TextArea] private string fiveCopy = "Diğer sayılar gibi, en az üç 5 taşını bir çizgide eşleştir.";

        internal void ShowSwap(int value) => Show(swapHeading, swapCopy.Replace("{sayı}", value.ToString()), true);
        internal void ShowGround() => Show(groundHeading, groundCopy, false);
        internal void ShowMechanic(UnityGameSession.MechanicLesson lesson)
        {
            switch (lesson)
            {
                case UnityGameSession.MechanicLesson.DoubleGround: Show(doubleGroundHeading, doubleGroundCopy, false); break;
                case UnityGameSession.MechanicLesson.Crates: Show(crateHeading, crateCopy, false); break;
                case UnityGameSession.MechanicLesson.FiveStone: Show(fiveHeading, fiveCopy, false); break;
            }
        }

        private void Show(string title, string instruction, bool focus)
        {
            heading.text = title;
            copy.text = instruction;
            hudWash.gameObject.SetActive(focus);
            gameObject.SetActive(true);
        }

        // Prefer the space above the bright cells. If the group is near the HUD,
        // move the prompt below it. All coordinates use the board camera's rect.
        internal void Position(RectTransform boardRegion, float low, float high, float cellRadius)
        {
            RectTransform area = (RectTransform)transform;
            if (area.rect.height <= 0) return;
            float bottom = boardRegion.anchorMin.y, top = boardRegion.anchorMax.y;
            float unit = Mathf.Min(area.rect.width, area.rect.height * .8f) / area.rect.height;
            float height = unit * .185f, gap = unit * .025f;
            float above = Mathf.LerpUnclamped(bottom, top, high + cellRadius) + gap;
            float below = Mathf.LerpUnclamped(bottom, top, low - cellRadius) - gap - height;
            float y = above + height <= top ? above : below >= bottom ? below : top - height;
            float width = Mathf.Min(.86f, area.rect.height * .75f / area.rect.width);
            FirstPlayableController.Place(prompt, .5f - width / 2f, y, .5f + width / 2f, y + height);
            FirstPlayableController.Place(hudWash, 0, top, 1, 1);
        }
    }
}

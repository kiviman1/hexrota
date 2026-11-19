using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    [DisallowMultipleComponent]
    public sealed class CastleGameToolsView : MonoBehaviour
    {
        [Header("Öğretici kartı")]
        [SerializeField] private RectTransform coachRegion;
        [SerializeField] private Text heading, counter, lessonTitle, copy;
        [SerializeField] private Button skip, acknowledge;
        [SerializeField] private RawImage face;
        [SerializeField] private Texture2D point, talk, celebrate;

        [Header("Tahtadaki rehber")]
        [SerializeField] private RectTransform gestureRegion, handMount;
        [SerializeField] private Image hand;
        [SerializeField] private TutorialGestureArrow arrow;
        [Tooltip("Eldivenin tahta genişliğine göre boyutu.")]
        [SerializeField, Range(.02f, .25f)] private float handWidth = .091f;
        [Tooltip("Parmak ucunun görseldeki normalize konumu, sol alt köşeden itibaren.")]
        [SerializeField] private Vector2 fingertip = new Vector2(.405f, .99f);
        [SerializeField] private Text feedback;
        [SerializeField] private OpeningLessonView openingLesson;
        private Color handTint;

        internal Text Feedback => feedback;
        internal TutorialGestureArrow DirectionArrow => arrow;
        internal OpeningLessonView Opening => openingLesson;
        internal bool ShowingLesson => coachRegion != null && coachRegion.gameObject.activeSelf;

        internal void Bind(FirstPlayableController game)
        {
            skip.onClick.AddListener(game.SkipLessons);
            acknowledge.onClick.AddListener(game.AcknowledgeTutorial);
            handTint = hand.color;
        }

        internal void FitRegions(MobileLayout.GameRegions layout)
        {
            FirstPlayableController.Place(coachRegion, 0, layout.CoachBottom, 1, layout.CoachTop);
            Rect board = layout.Board;
            FirstPlayableController.Place(gestureRegion, board.xMin, board.yMin, board.xMax, board.yMax);
        }

        internal void SetLesson(bool lesson, bool needsAcknowledgement)
        {
            coachRegion.gameObject.SetActive(lesson);
            acknowledge.gameObject.SetActive(needsAcknowledgement);
            skip.gameObject.SetActive(!needsAcknowledgement);
        }

        internal void ShowCard(UnityGameSession.LessonCard card, bool showCopy)
        {
            heading.text = card.Heading;
            counter.text = card.Counter;
            if (!showCopy) return;
            lessonTitle.text = card.Title;
            copy.text = card.Text;
        }

        internal void ShowPose(bool speaking)
        {
            if (face == null) return;
            face.texture = speaking ? talk : acknowledge.gameObject.activeSelf ? celebrate : point;
        }

        internal void ShowGuide(bool visible)
        {
            if (gestureRegion != null) gestureRegion.gameObject.SetActive(visible);
        }

        internal void MoveGuide(Vector2 from, Vector2 to, float position, float opacity, float boardAspect)
        {
            arrow.SetPair(from, to);
            var point = Vector2.Lerp(from, to, position);
            var sprite = hand.overrideSprite;
            float spriteAspect = sprite == null ? 1 : sprite.rect.width / sprite.rect.height;
            float height = handWidth * boardAspect / spriteAspect;
            float x = point.x - handWidth * fingertip.x;
            float y = point.y - height * fingertip.y;
            FirstPlayableController.Place(handMount, x, y, x + handWidth, y + height);
            hand.color = new Color(handTint.r, handTint.g, handTint.b, opacity * handTint.a);
        }
    }
}

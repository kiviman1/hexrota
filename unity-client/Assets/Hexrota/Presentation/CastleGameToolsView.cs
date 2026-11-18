using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    [DisallowMultipleComponent]
    public sealed class CastleGameToolsView : MonoBehaviour
    {
        [Header("Alt menü")]
        [SerializeField] private RectTransform dockRegion;
        [SerializeField] private GameObject tutorialDock, campaignDock;
        [SerializeField] private Button tutorialMenu, tutorialPause;
        [SerializeField] private Button menu, restart, inventory, pause, settings;

        [Header("Öğretici kartı")]
        [SerializeField] private RectTransform coachRegion;
        [SerializeField] private Text heading, counter, lessonTitle, copy;
        [SerializeField] private Button skip, acknowledge;
        [SerializeField] private RawImage face;
        [SerializeField] private Texture2D point, talk, celebrate;

        [Header("Tahtadaki rehber")]
        [SerializeField] private RectTransform gestureRegion, handMount, actorMount;
        [SerializeField] private Image hand;
        [SerializeField] private TutorialGestureArrow arrow;
        [SerializeField] private RawImage actor;
        [Tooltip("Eldivenin tahta genişliğine göre boyutu.")]
        [SerializeField, Range(.02f, .25f)] private float handWidth = .091f;
        [Tooltip("Parmak ucunun görseldeki normalize konumu, sol alt köşeden itibaren.")]
        [SerializeField] private Vector2 fingertip = new Vector2(.405f, .99f);
        [SerializeField] private Text feedback;
        private Color handTint;

        internal Text Feedback => feedback;
        internal TutorialGestureArrow DirectionArrow => arrow;
        internal bool ShowingLesson => coachRegion != null && coachRegion.gameObject.activeSelf;
        internal bool CanShowActor => actor != null && actor.texture != null;
        internal RectTransform ActorMount => actorMount;

        internal void Bind(FirstPlayableController game)
        {
            tutorialMenu.onClick.AddListener(game.ReturnToMenu);
            tutorialPause.onClick.AddListener(game.Pause);
            menu.onClick.AddListener(game.ReturnToMenu);
            restart.onClick.AddListener(game.ConfirmRestart);
            inventory.onClick.AddListener(game.OpenInventory);
            pause.onClick.AddListener(game.Pause);
            settings.onClick.AddListener(game.OpenMobileSettings);
            skip.onClick.AddListener(game.SkipLessons);
            acknowledge.onClick.AddListener(game.AcknowledgeTutorial);
            handTint = hand.color;
        }

        internal void FitRegions(MobileLayout.GameRegions layout)
        {
            FirstPlayableController.Place(dockRegion, 0, 0, 1, layout.Footer);
            FirstPlayableController.Place(coachRegion, 0, layout.CoachBottom, 1, layout.CoachTop);
            Rect board = layout.Board;
            FirstPlayableController.Place(gestureRegion, board.xMin, board.yMin, board.xMax, board.yMax);
        }

        internal void SetLesson(bool lesson, bool needsAcknowledgement)
        {
            tutorialDock.SetActive(lesson);
            campaignDock.SetActive(!lesson);
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
            gestureRegion.gameObject.SetActive(visible);
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

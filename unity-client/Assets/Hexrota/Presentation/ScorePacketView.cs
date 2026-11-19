using System.Globalization;
using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    public sealed class ScorePacketView : MonoBehaviour
    {
        [SerializeField] private Text amount;
        [SerializeField] private Text headline;
        [SerializeField] private string gainFormat = "+{gain}";

        internal void ShowWave(int gain, string caption)
        {
            amount.text = gainFormat.Replace("{gain}", gain.ToString(CultureInfo.InvariantCulture));
            headline.text = caption;
        }

        internal void ShowHeadline(bool visible)
        {
            headline.gameObject.SetActive(visible && headline.text.Length > 0);
        }
    }
}

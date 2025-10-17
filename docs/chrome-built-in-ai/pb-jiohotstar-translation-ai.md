# How Policybazaar and JioHotstar use the Translator and Language Detector APIs to build multilingual experiences  |  Blog  |  Chrome for Developers

![Swetha Gopalakrishnan](https://web.dev/images/authors/swethagopalakrishnan.jpg)

![Saurabh Rajpal](https://web.dev/images/authors/saurabhrajpal.jpg)

Published: May 8, 2025

Make your content accessible to a global audience with the [Translator API](/docs/ai/translator-api) and the [Language Detector API](/docs/ai/language-detection). With the Language Detector API, you can determine what language is used in an input and with the Translator API, you can translate from that detected language to another language. Both APIs run [client-side with AI models built into Chrome](/docs/ai/client-side), which means it's fast, secure, and free to use, as there are no server costs.

API

Explainer

Web

Extensions

Chrome Status

Intent

[Translator API](/docs/ai/translator-api)

[MDN](https://developer.mozilla.org/docs/Web/API/Translator_and_Language_Detector_APIs)

![](/static/images/chrome_logo.svg) Chrome 138

![](/static/images/chrome_logo.svg) Chrome 138

[View](https://chromestatus.com/feature/5172811302961152)

[Intent to Ship](https://groups.google.com/a/chromium.org/g/blink-dev/c/eCE8jIW2auo/m/3vMI6eQqBAAJ)

[Language Detector API](/docs/ai/language-detector-api)

[MDN](https://developer.mozilla.org/docs/Web/API/Translator_and_Language_Detector_APIs)

![](/static/images/chrome_logo.svg) Chrome 138

![](/static/images/chrome_logo.svg) Chrome 138

[View](https://chromestatus.com/feature/6494349985841152)

[Intent to Ship](https://groups.google.com/a/chromium.org/g/blink-dev/c/sWcHBe9wpbo/m/H8Xp7NXTCQAJ)

Learn how two large international businesses, Policybazaar and JioHotstar, are using and benefiting from these built-in APIs.

## Policybazaar's multilingual customer assistance

![](/static/blog/pb-jiohotstar-translation-ai/image/pb-logo.png)

Policybazaar is the largest insurance platform in India, with over 97 million registered customers. India has an [incredible linguistic diversity](https://timesofindia.indiatimes.com/travel/destinations/top-10-most-spoken-languages-in-india/photostory/111900431.cms), with numerous languages and dialects spoken across the country.

To support this linguistic diversity among their customers, Policybazaar implemented the Translator and Language Detector APIs in two ways: providing insurance assistance at any time and offering articles with market insights in their customer's preferred language.

### Insurance assistance with Finova AI

Insurance is an inherently personal product, with sensitive information as the basis of specific policies. Policybazaar's customers often seek guidance on how to choose a plan or what their plan supports. While they have a staff that speaks many languages, Policybazaar needed a solution that would work across time zones and after hours. So, Policybazaar built Finova AI, tailored insurance assistance in a customer's preferred language.

Users can chat with the Finova chatbot in their first language.

> "Chrome's Language Detector and Translator APIs have helped make our insurance assistance more seamless by catering to our customers' diverse language needs. As a result, users can communicate in their preferred Indic language, without noticeable delays."
> 
> —Rishabh Mehrotra, Head of Design Life Insurance Business Unit at Policybazaar

The team chose client-side AI, which is inference that occurs in a browser or on a user's device. Client-side AI offers minimal latency and a lower cost than server-hosted or serverless AI. Given the rapid pace and volume of messages in a real-time conversation, a server-based solution would be costly and time-consuming.

Chrome's implementation of built-in AI offers models built in the browser, so inference is performed on-device. It's a compelling solution to fulfill the primary requirements.

```
// Language Detector and Translator APIs implemented with React
import { useRef } from "react";

const useService = () => {
  const languageModel = useRef(null);
  const translatorCapabilitiesModel = useRef(null);
  const loadAllModels = async () => {
    if (window?.LanguageDetector) {
      languageModel.current = await window.LanguageDetector.create().catch(() => null);
    }
  }

  // Detect what language the customer is writing
  const detectLanguage = async (message) => {
    if (!languageModel.current) return "";
    try {
      const [result] = await languageModel.current.detect(message);
      const { detectedLanguage, confidence } = result || {};
      return confidence * 100 > 50 ? detectedLanguage : "";
    } catch (err) {
      console.error(err);
      return "";
    }
  };

  // Translate messages to and from the detected language and English
  const translateMessage = async (message, detectedLanguage, targetLanguage = 'en') => {
    try {
      const modelAvailability = await window.Translator.availability({ sourceLanguage: detectedLanguage, targetLanguage });
      if (!['available', 'downloadable'].includes(modelAvailability)) {
        return message;
      }
      const translator = await window.Translator.create({ sourceLanguage: detectedLanguage, targetLanguage });
      const translatedMessage = await translator.translate(message);
      return translatedMessage;
    } catch (error) {
      return message;
    }
  }

  return { detectLanguage, translateMessage, loadAllModels };
}

export default useService;
```

### Article translation for market insights

> "The Translator API was extremely easy to integrate into our existing React code. We opted for this client-side solution to ensure fast translation for our customers and agents. The API was able to translate a 1,000 character article within two seconds."
> 
> —Aman Soni, Tech Lead at Policybazaar

Policybazaar's Life Insurance business vertical provides a wealth of articles to keep customers and customer support agents informed about market conditions.

Hindi is a language widely spoken amongst their users, so they piloted the Translator API for on-demand translation of articles from English to Hindi.

Policybazaar provides seamless and fast translation between English and Hindi.

To add translation to their website, they used the following script:

```
// Initialize the translator, setting source and target languages
var translator = null;
var translatorAvailable = false;
var languageOptionsData = { name: "Hindi", code: "hi" };
var IGNORED_TEXT_NODES = ['RSI', 'NAV'];

function checkForLanguageOptions() {
  if (window.Translator) {
    translatorAvailable = true;
    return window.Translator.create({
      sourceLanguage: 'en',
      targetLanguage: languageOptionsData.code
    }).then(function (createdTranslator) {
      translator = createdTranslator;
    });
  } else {
    translatorAvailable = false;
    return Promise.resolve();
  }
}

/**
 * Translate the article content using the Translator API.
 * @param {HTMLElement} container - element that holds the article content.
 * @return {Promise<string>} A promise that resolves to the container's innerHTML after translation.
 */
function translateArticle(container) {
  if (!translatorAvailable) { return Promise.resolve(''); }

  var textNodes = getAllTextNodes(container);
  var promiseChain = Promise.resolve();

  textNodes.forEach(function (element) {
    if (IGNORED_TEXT_NODES.indexOf(element.nodeValue) !== -1) return;
    var message = element.nodeValue;
    promiseChain = promiseChain.then(function () {
      return translator.translate(message).then(function (translated) {
        element.nodeValue = translated;
      }).catch(function (error) {
        console.error('Translation error:', error);
      });
    });
  });

  return promiseChain.then(function () {
    return container.innerHTML;
  });
}
```

With the model and API delivered by Chrome, customers can access near instant translation of articles.

## JioHotstar offers dynamic subtitle translation

![](/static/blog/pb-jiohotstar-translation-ai/image/JioHotstar_logo.jpg)

JioHotstar, a leading digital streaming platform in India offering a wide range of movies, TV shows, sports, and original content in multiple languages, is exploring Translator API to enhance subtitle translation.

JioHotstar caters to Indian users who are inclined to consume content in their regional language. Given the breadth of content catalogue available with JioHotstar, it's a challenge to cater to the regional language needs of all users, thus improving their content consumption.

With the Translator API, the platform aims to dynamically translate English subtitles into the user's preferred language or based on their geographic region. The option for dynamic translation is offered in the language selection menu where we automatically detect missing original subtitles and augment them from Chrome supported languages. This improves the user experience of captions and makes the content accessible to more users.

The list of available dynamic languages is generated by checking the browser for existing language packs, based on a main list tailored to each user's preferences and geographic location. When a user selects a language and the corresponding language pack is already downloaded in the browser, the translated text appears immediately. Otherwise, the pack is downloaded first, and then translation begins.

Once the user selects a language and sees translation happening, they can be confident that the language pack has been successfully downloaded. From that point on, any captioned content can be viewed in the selected language. This helps eliminate uncertainty for users who might otherwise hesitate to browse content, unsure whether it would be available in their preferred language.

The following code sample initializes and sets up the translator.

```
class SubTitleTranslator {
  // Cache translator instances based on source-target language pair, so that we don't create this often for multiple contents
  #translatorMap = {};
  // Get or create a translator for the language pair
  async #createTranslator(sourceLanguage, targetLanguage) {
    const key = `${sourceLanguage}-${targetLanguage}`;
    const translator = this.#translatorMap[key];
    // Check if a translator already exists for a language pair in the map
    if (translator) {
      return translator;
    }
    // Check if translation is available
    const isAvailable =
      (await Translator.availability({ sourceLanguage, targetLanguage })) ===
      "available";
    if (isAvailable) {
      // If available, create a new translator and cache it
      this.#translatorMap[key] = await Translator.create({
        sourceLanguage,
        targetLanguage,
      });
      return this.#translatorMap[key];
    }

    return null;
  }
  // Translate text
  async #translateText(text, sourceLanguage, targetLanguage) {
    const translator = await this.#createTranslator(
      sourceLanguage,
      targetLanguage
    );
    // Returns the given input text if translator is unavailable
    if (!translator) {
      return text;
    }
    return await translator.translate(text);
  }
  // Public method to get a reusable translation function for a specific language pair.
  getTranslatorFor(sourceLanguage, targetLanguage) {
    return async (text) => {
      try {
        return this.#translateText(text, sourceLanguage, targetLanguage);
      } catch {
        return text;
      }
    };
  }
}
```

Then, they use the Translator API to generate translated subtitles.

```
const translatorFactory = new SubTitleTranslator();

/* Accept English input and translate to Tamil.*/
const translateToTamil = translatorFactory.getTranslatorFor('en','ta');

/* Accept English text as input and translate it to Japanese. */
const translateToJapanese = translatorFactory.getTranslatorFor('en','ja');

/* Accept English input and returns English, as `JTA` is not a valid language code. */
const translateToUnknownLanguage = translatorFactory.getTranslatorFor('en','jta');
```

There are a few additional functions that update the final rendered subtitles.

```
/* updateSubtitle is the internal function that updates the rendered subtitle. */
translateToTamil('hi').then(result => updateSubtitle(result))
translateToJapanese('hi').then(result => updateSubtitle(result))
translateToUnknownLanguage('hi').then(result => updateSubtitle(result))
```

## Best practices

While these uses of the Translator and Language Detector APIs are different, there are many common best practices:

-   Conduct quality assessments for translated text to ensure that grammar and context are preserved. Consider providing an option for users to give feedback on the translation if appropriate.
-   Provide a progress UI such as a spinner, loader or progress bar to indicate responsiveness. For example, Policybazaar used a typing indicator for the chatbot to show that it was processing the user's input.

## Conclusions and recommendations

Are you building something new with these APIs? Share it with us at [@ChromiumDev on X](https://x.com/chromiumdev) or [Chromium for Developers on LinkedIn](https://www.linkedin.com/showcase/chrome-for-developers/).

### Resources

-   [Start using Built-in APIs on Chrome](/docs/ai/built-in-apis)
-   [Learn more about Language Detector API](/docs/ai/language-detection)
-   [Learn more about Translator API](/docs/ai/translator-api)
-   [Empowering bloggers: How CyberAgent deployed built-in AI to enhance content creation](/blog/prompt-api-blog-cyberagent)

### Acknowledgements

Thank you to [Rishabh Mehrotra](https://in.linkedin.com/in/rishabh-mehrotra-4483a274) and [Aman Soni](https://in.linkedin.com/in/amansoni211) from Policybazaar, [Bhuvaneswaran Mohan](https://www.linkedin.com/in/bhuvaneswaran-mohan/) and [Ankeet Maini](https://in.linkedin.com/in/ankeetmaini) from JioHotstar, [Alexandra Klepper](/authors/alexandra-klepper), [Thomas Steiner](/authors/thomas-steiner) and [Kenji Baheux](https://jp.linkedin.com/in/baheux) for helping to write and review this article.
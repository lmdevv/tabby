# The Summarizer API helps redBus and Miravia create helpful user review summaries  |  Blog  |  Chrome for Developers

![Cecilia Cong](https://web.dev/images/authors/cecilia-cong.jpg)

![Hadyan Andika](https://web.dev/images/authors/handika.jpg)

Published: May 15, 2025

Websites with user reviews, such as ecommerce or travel sites, often have a huge volume of information. This can make it time-consuming for users to sift through lots of reviews to decide on a purchase. Providing review summaries can help users to understand feedback and save time. Learn how redBus and Miravia use the Summarizer API to improve decision-making and purchase experience.

Explainer

Web

Extensions

Chrome Status

Intent

[MDN](https://developer.mozilla.org/docs/Web/API/Summarizer/)

![](/static/images/chrome_logo.svg) Chrome 138

![](/static/images/chrome_logo.svg) Chrome 138

[View](https://chromestatus.com/feature/5193953788559360)

[Intent to Ship](https://groups.google.com/a/chromium.org/g/blink-dev/c/cpyB56aHWs4/m/8NTdmGV8AAAJ)

The [Summarizer API](/docs/ai/summarizer-api) lets you generate different types of summaries in varied lengths and formats, such as sentences, paragraphs, bullet point lists, and more. This API, like many of our [built-in AI APIs](/docs/ai/built-in-apis), use large language models to perform inference. In Chrome, our model is Gemini Nano.

## redBus helps customers decide the best bus option

redBus is the largest bus provider in India, with more than 30 million customers, providing bus services across approximately 10,000 cities and towns, connected nationwide. Through data and feedback, redBus realized that user-generated reviews play an important part in helping customers determine what route and which bus is best for their travel needs. redBus receives a high volume of reviews, and each review is specific to the exact arrival and departure points and time.

To help customers understand at a high-level for certain cities or routes, they use the Summarizer API to present key insights from relevant reviews.

A customer looks for a route from Bangalore to Mangaluru. The summarizer looks at the available reviews and captures a useful overview to help customers find the best bus for their journey.

> "The Summarizer API was able to create quality summaries from our large number of reviews and user search query permutations. This client-side feature removed the technical complexity and additional business cost which would be present for a server-side alternative. This is important to us because this use case is part of the conversion funnel."
> 
> — Amit Kumar, Senior Engineering Manager, redBus

The granularity of reviews that are stored on redBus' backend, combined with the enormous number of possible permutations in user search queries—with variables such as departure and arrival times, specific boarding point in the city, and different bus operators—makes it difficult to highlight specific insights from the reviews. With that volume of data, a server-side summary for each search query would be cost prohibitive.

To generate effective summaries, redBus supplies the following context to the Summarizer API, in addition to the customer reviews:

```
//Context to provide a useful summary
const promptContext =
  'Summarize the following reviews in 30 words or less.' +
  'Focus on key positives and negatives, such as comfort, maintenance,' +
  'pricing, and cleanliness. Reviews are separated by {end}.' +
  'Give the summary in just one paragraph.';
```

The summaries improve customer decision making, without additional business costs and technical complexity. Additionally, redBus can personalize the summary for logged-in users travel preferences, such as seat comfort or Wi-Fi availability. Inference client-side, which means this search and summary remains private to the user.

Take a look at a short code sample which checks for Summarizer availability, gives context, and retrieves reviews based on the user's search query.

```
// The Summarizer API is available
if ('Summarizer' in self) {
  try {
    const available = await Summarizer.availability();
    let summarizer;
    if (available === 'unavailable') {
      return null;
    }
    if (available === 'available') {
      //model is already available, use immediately
      summarizer = await Summarizer.create();
    } else {
      //trigger model download and wait
      summarizer = await Summarizer.create();
    }

    // Context to provide a useful summary
    const promptContext =
      'Summarize the following reviews in 30 words or less.' +
      'Focus on key positives and negatives, such as comfort, maintenance,' +
      'pricing, and cleanliness. Reviews are separated by {end}.' +
      'Give the summary in just one paragraph.';

    // Retrieve the reviews to be summarized based on user's search query
    let reviews = getIndividualBusReviews();
    if (reviews) {
      const reviewSummary = await summarizer.summarize(reviews, {
        context: promptContext
      });
    }
  } catch (e) {
    console.error("SUMMARIZER_API_ERROR: ", e);
    return null
  }
}
```

With the example search of Bangalore to Mangaluru, the output of the summarizer is as follows:

_`<Bus Provider X>` generally received positive reviews for comfort, cleanliness, and staff service. Some experienced minor issues like delays, driver behavior (rude), lack of amenities (live tracking, blankets), and discomfort (seat size, poor shock absorbers)._

This review meets the requested requirements, with positives and negatives in one short paragraph, which is much easier to read than the 308 available individual reviews.

## Miravia summarized ecommerce reviews

Miravia is a leading ecommerce platform in Spain, with millions of monthly active users. Whenever users filter reviews (for example, by product rating), a new summary is generated. This provides a succinct overview of customer feedback, highlighting concerns and recommendations.

Users can generate product review summaries for different ratings.

> "Previously, understanding the key pros and cons within product reviews required users to read through numerous individual comments on the detail page. To help users quickly grasp overall customer sentiment, we've introduced the Summarizer API. This summary dynamically updates whenever a user filters the reviews (such as, by star rating or other criteria), providing a fast and comprehensive overview of relevant buyer feedback."
> 
> — Ziyi Liang, Senior Software Engineer, Miravia

Initially, Miravia's user review summarization feature relied on a server-side AI service. They found that Gemini Nano running client-side AI can deliver comparable results, with a reduction in maintenance costs. This advantage is particularly clear for popular, fast-selling items, whose reviews are constantly updated.

While Miravia's implementation requires real-time review fetching and summarization, whether inference occurs on the server or in the browser, client-side AI is notably more efficient as the frequency increases. They're satisfied with its overall performance.

First, Miravia checks for feature and device compatibility.

```
// Compatibility check for device with built-in AI
export const deviceCheck = async () => {
  // Query the browser's AI capabilities
  const availability = await Summarizer.availability();

  // Case 1: Device doesn't support AI summarization
  if (availability === 'unavailable') {
    return {
      summarizationAvailable: false,
      message:
        'AI summarization tools are not supported on this device, or the appropriate permissions have not be set.',
    };
  }

  // Case 2: Device supports AI but requires model download
  if (availability === 'downloadable') {
    // Try to trigger an installation
    Summarizer.create();

    return {
      summarizationAvailable: false,
      message: 'Installing in the background. This may take a few minutes...',
    };
  }

  // Case 3: Device supports AI summarization
  return {
    summarizationAvailable: true,
    message: 'Ready for use.',
  };
};
```

Then, Miravia summarizes the available reviews. Reviews are joined with an additional period, to make the input more coherent.

```
/**
 * Summarizes a list of reviews using Chrome's Built-in AI
 * @param {Array<string>} reviewContentList - Array of review texts to summarize
 * @returns {Promise<string>} The generated summary text
 * @throws {Error} If summarization is not available or fails
 */
export const reviewSummarize = async (reviewContentList) => {
  // Validate input
  if (!Array.isArray(reviewContentList) || !reviewContentList.length) {
    throw new Error('Please provide a non-empty array of reviews to summarize');
  }

  // Check device compatibility
  const { summarizationAvailable, message } = await deviceCheck();

  if (summarizationAvailable) {
    try {
      // Configure and create the summarizer with appropriate parameters
      const summarizer = await Summarizer.create({
        type: 'tl;dr',
        length: 'short',
        sharedContext:
          'Summarize the given user reviews. Maintain a polite and formal tone.',
      });

      // Generate the summary from the joined review texts
      const summary = await summarizer.summarize(reviewContentList.join('. '));

      // Return the generated summary
      return summary;
    } catch (error) {
      // Handle any errors during summarization
      throw new Error(`Summarization failed: ${error.message}`);
    }
  } else {
    // If summarization is not available, throw an error with the message from deviceCheck
    throw new Error(
      message ||
        'AI summarization tools are not supported on this device or browser.'
    );
  }
};
```

## Best practices

If the review input exceeds the token limit, follow these mitigations:

-   Use a smaller sample (such as the most recent 4 reviews) to the API. This helps generate faster results. Refer to our guidance on [scaling client-side summarization](/docs/ai/scale-summarization).
-   The `QuotaExceededError` provides more information about the requested tokens in the input. The `summarizer` object has an `inputQuota` property that indicates the API's token limit. This allows for real-time feedback and disabling functionality if the input exceeds the limit.

You may want to consider a hybrid approach, to ensure a seamless experience for all users. The first time a built-in AI API is called, the browser must download the model.

-   Miravia used a server-side model to provide an initial summary, while the model was downloading. Once the built-in model was ready, the site switched to performing inference client-side.

You should always strive to create a friendly and communicative interface:

-   [Implement a progress bar](https://web.dev/articles/building/a-loading-bar-component) for model downloads and mitigate response delays.
-   Consider transparency about the model download. Bright Sites notified users about the model download to allow for transparency and consent of resource usage. That way, users could accept or decline before proceeding.

## Conclusions and recommendations

These real-world examples from redBus and Miravia demonstrate how the Summarizer API helped users make informed decisions quickly by providing concise, relevant summaries of user reviews. The API's ability to work client-side, without additional business cost and low technical complexity, makes it a viable option for similar use cases where information needs to be summarized. All of the [built-in AI APIs](/docs/ai/built-in-apis) enable practical client-side AI use cases.

Wondering how the Summarizer API can help with other use cases? We've also shared how [the Summarizer API helps increase article engagement](/blog/summarizer-terra-brightsites).

Are you building something new with these APIs? Share it with us at [@ChromiumDev on X](https://x.com/chromiumdev) or [Chromium for Developers on LinkedIn](https://www.linkedin.com/showcase/chrome-for-developers/).

## Resources

-   [Learn more about Summarizer API](/docs/ai/summarizer-api).
-   [Start using Built-in APIs on Chrome](/docs/ai/built-in-apis).
-   Read the [Prompt API case study on empowering bloggers](/blog/prompt-api-blog-cyberagent).
-   Read the [Translation and Language Detector case study](/blog/pb-jiohotstar-translation-ai).
-   Read how the [Summarizer API helps Bright Sites and Terra create engaging article summaries](/blog/summarizer-terra-brightsites)

## Acknowledgements

Thank you to Makakhov Andrey and Ziyi Liang from Miravia (Alibaba Group), [Amit Kumar](https://www.linkedin.com/in/amit-kumar-8385b734/) from redBus, [Swetha Gopalakrishnan](https://www.linkedin.com/in/swetha-gopalakrishnan-5ba92936/), [Alexandra Klepper](/authors/alexandra-klepper), [Thomas Steiner](/authors/thomas-steiner) and [Kenji Baheux](https://jp.linkedin.com/in/baheux) for helping to write and review this document.
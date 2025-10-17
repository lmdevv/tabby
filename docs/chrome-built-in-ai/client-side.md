# When to choose client-side AI

## When to choose client-side AI

![Maud Nalpas](https://web.dev/images/authors/maudn.jpg)

![Alexandra Klepper](https://web.dev/images/authors/alexandraklepper.jpg)

Published: May 14, 2024

Client-side AI inference occurs on-device, which can be incredibly powerful alongside any existing server-side setup. [Built-in AI](/docs/ai/built-in) is one form of client-side AI which brings models to the browser, protecting sensitive data and improving latency.

-   **Privacy and security**: Client-side AI lets you work with data locally, which greatly impacts your ability to work with sensitive data and keep it safe and private. You can offer AI features to users with end-to-end encryption.
-   **Greater availability**: Client-side AI can help achieve greater availability to your users. Your users' devices can shoulder some of the processing load in exchange for more access to AI features. If your product offers a premium service, you could consider a free tier with client-side AI features to help your customers get a glimpse of what the premium service provides.

Running client-side AI cannot completely replace and replicate the work you do on the cloud. After all, servers are incredibly powerful and able to hold large, complex models that deliver results fast.

Client-side isn't always the right choice, so before we move further, we want to remind you of some best practices:

1.  **Design your features with graceful fallbacks** and run benchmarks on your target devices. Not every device will be able to act as an AI powerhouse.
2.  **Build for specific use cases**. Client-side AI works best for specific use cases. The models are inherently smaller than what's typically found in server-side AI. Break your process down into targeted steps and make use of pre- and post-processing, so that smaller models can still deliver the best possible response.
3.  **Be strategic about download requirements**. AI models can be large, which could lead to a large use of mobile data and device storage. Make sure you're building a useful feature for your users and that you have a responsible serving and caching strategy.

We want to hear about what use cases most interest you and your feedback on our approach. You can [share feedback and join the Early Preview Program](https://forms.gle/LYoT5EnQVcHiP3348) to test with local prototypes.

Your contribution can help us make AI a powerful, yet practical, tool for everyone.

[Get started](/docs/ai/get-started) with built-in AI APIs in Chrome.

Except as otherwise noted, the content of this page is licensed under the [Creative Commons Attribution 4.0 License](https://creativecommons.org/licenses/by/4.0/), and code samples are licensed under the [Apache 2.0 License](https://www.apache.org/licenses/LICENSE-2.0). For details, see the [Google Developers Site Policies](https://developers.google.com/site-policies). Java is a registered trademark of Oracle and/or its affiliates.

Last updated 2024-05-14 UTC.
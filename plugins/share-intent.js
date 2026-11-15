/**
 * Share-target config for expo-share-intent (SDK 58). Plain JavaScript so app.config.ts can load it: Expo compiles
 * the config file, and a TypeScript import beside it is not compiled. The App Group id is `group.<bundle id>` so
 * each side-by-side install has its own container. The extension bundle id is `<bundle id>.share-extension`.
 */

/** Android SEND / SEND_MULTIPLE types. `image/*` covers HEIC; Office and text are named because Android does not treat them as images. */
const SHARE_INTENT_TYPES = [
  'text/*',
  'image/*',
  'image/heic',
  'image/heif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
]

function appGroupId(bundleId) {
  return `group.${bundleId}`
}

function shareExtensionBundleId(bundleId) {
  return `${bundleId}.share-extension`
}

/**
 * Plugin entry. The extension name stays unset so the share sheet shows the app name and the target stays
 * ShareExtension. A dictionary of iOS activation rules is combined with AND, so a PDF alone would not match an
 * image rule. This predicate is OR: text, links, images (including HEIC) and files.
 */
function shareIntentPlugin(bundleId) {
  return [
    'expo-share-intent',
    {
      iosAppGroupIdentifier: appGroupId(bundleId),
      iosShareExtensionBundleIdentifier: shareExtensionBundleId(bundleId),
      iosActivationRules:
        'SUBQUERY(extensionItems, $extensionItem, SUBQUERY($extensionItem.attachments, $attachment, ANY $attachment.registeredTypeIdentifiers UTI-CONFORMS-TO "public.image" OR ANY $attachment.registeredTypeIdentifiers UTI-CONFORMS-TO "org.webmproject.webp" OR ANY $attachment.registeredTypeIdentifiers UTI-CONFORMS-TO "public.file-url" OR ANY $attachment.registeredTypeIdentifiers UTI-CONFORMS-TO "public.text" OR ANY $attachment.registeredTypeIdentifiers UTI-CONFORMS-TO "public.url" OR ANY $attachment.registeredTypeIdentifiers UTI-CONFORMS-TO "com.adobe.pdf" OR ANY $attachment.registeredTypeIdentifiers UTI-CONFORMS-TO "com.microsoft.word.doc" OR ANY $attachment.registeredTypeIdentifiers UTI-CONFORMS-TO "org.openxmlformats.wordprocessingml.document" OR ANY $attachment.registeredTypeIdentifiers UTI-CONFORMS-TO "com.microsoft.powerpoint.ppt" OR ANY $attachment.registeredTypeIdentifiers UTI-CONFORMS-TO "org.openxmlformats.presentationml.presentation").@count >= 1).@count >= 1',
      androidIntentFilters: [...SHARE_INTENT_TYPES],
      androidMultiIntentFilters: [...SHARE_INTENT_TYPES],
      // singleTask brings an already-open app forward when another app shares into it.
      androidMainActivityAttributes: { 'android:launchMode': 'singleTask' },
    },
  ]
}

module.exports = { SHARE_INTENT_TYPES, appGroupId, shareExtensionBundleId, shareIntentPlugin }

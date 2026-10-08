// Pins the Google Services Gradle plugin (it reads google-services.json) to the version the Firebase console asks for.
// Expo's own `android.googleServicesFile` support adds 4.4.4 and leaves an existing classpath alone, so this either
// inserts the pinned classpath first or rewrites Expo's — whichever runs first.
const { withProjectBuildGradle } = require('expo/config-plugins')

const CLASSPATH = 'com.google.gms:google-services'

module.exports = function withGoogleServicesVersion(config, { version }) {
  return withProjectBuildGradle(config, (mod) => {
    const gradle = mod.modResults.contents
    mod.modResults.contents = gradle.includes(CLASSPATH)
      ? gradle.replace(new RegExp(`${CLASSPATH}:[\\d.]+`), `${CLASSPATH}:${version}`)
      : gradle.replace(/dependencies\s?{/, `dependencies {\n        classpath '${CLASSPATH}:${version}'`)
    return mod
  })
}

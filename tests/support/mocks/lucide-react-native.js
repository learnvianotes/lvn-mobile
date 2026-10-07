// Jest only: lucide-react-native ships .mjs icons that jest-expo does not transform; icons are not under test.
const Icon = () => null
module.exports = new Proxy({}, { get: () => Icon })

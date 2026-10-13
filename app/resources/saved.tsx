import { Redirect } from 'expo-router'

/** Saved resources are a section of Saved now (lvn-backend ADR-0076): old links land there. */
export default function SavedResources() {
  return <Redirect href="/saved" />
}

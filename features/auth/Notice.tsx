import { AlertCircle, CheckCircle2 } from 'lucide-react-native'
import { Alert, AlertTitle } from '@/components/ui/alert'

/** A one-line message above a form: the API's general userError, or a confirmation. */
export function Notice({ tone = 'error', children }: { tone?: 'error' | 'success' | 'info'; children: string }) {
  return (
    <Alert icon={tone === 'success' ? CheckCircle2 : AlertCircle} variant={tone === 'error' ? 'destructive' : tone === 'success' ? 'success' : 'default'}>
      <AlertTitle className="leading-5">{children}</AlertTitle>
    </Alert>
  )
}

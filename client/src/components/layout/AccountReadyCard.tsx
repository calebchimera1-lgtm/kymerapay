import { CheckCircle2, Clock } from 'lucide-react';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';

interface Step {
  label: string;
  done: boolean;
}

/** Account set-up checklist shown until wallet features are live. */
export function AccountReadyCard({ steps }: { steps: Step[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your account is ready</CardTitle>
      </CardHeader>
      <CardBody>
        <ul className="space-y-3">
          {steps.map(({ label, done }) => (
            <li key={label} className="flex items-center gap-3 text-sm">
              {done ? (
                <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden="true" />
              ) : (
                <Clock className="size-5 shrink-0 text-fg-subtle" aria-hidden="true" />
              )}
              <span className={done ? '' : 'text-fg-muted'}>{label}</span>
              <span className="sr-only">{done ? '(done)' : '(coming soon)'}</span>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

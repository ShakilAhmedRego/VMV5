// @ts-nocheck
import VerticalRenderer from '@/components/verticals/VerticalRenderer'
import { VERTICAL_KEYS } from '@/lib/verticals'

export function generateStaticParams() {
  return VERTICAL_KEYS.map(key => ({ verticalKey: key }))
}

export default function VerticalPage({
  params,
}: {
  params: { verticalKey: string }
}) {
  return <VerticalRenderer verticalKey={params.verticalKey} />
}

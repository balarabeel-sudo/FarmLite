const shimmerStyle = `
@keyframes farmlite-shimmer {
  0% { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}
`

const shimmerBg = {
  backgroundImage: 'linear-gradient(90deg, #E7EFE7 0px, #F3F7F3 40px, #E7EFE7 80px)',
  backgroundSize: '600px 100%',
  animation: 'farmlite-shimmer 1.4s infinite linear',
}

function Block({ width, height, radius = 8, style = {} }: { width: string | number; height: string | number; radius?: number; style?: React.CSSProperties }) {
  return <div style={{ width, height, borderRadius: radius, ...shimmerBg, ...style }} />
}

// Renders the @keyframes once. Safe to include in every skeleton component.
function ShimmerStyleTag() {
  return <style>{shimmerStyle}</style>
}

export function ListCardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <>
      <ShimmerStyleTag />
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ background: '#FFFFFF', borderRadius: '16px', padding: '14px', marginBottom: '12px', display: 'flex', gap: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <Block width={52} height={52} radius={12} />
          <div style={{ flex: 1 }}>
            <Block width="60%" height={13} />
            <div style={{ height: 8 }} />
            <Block width="40%" height={11} />
            <div style={{ height: 8 }} />
            <Block width="30%" height={11} />
          </div>
        </div>
      ))}
    </>
  )
}

export function GridCardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <>
      <ShimmerStyleTag />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} style={{ background: '#FFFFFF', borderRadius: '14px', padding: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
            <Block width="100%" height={90} radius={10} />
            <div style={{ height: 8 }} />
            <Block width="80%" height={12} />
            <div style={{ height: 6 }} />
            <Block width="50%" height={11} />
          </div>
        ))}
      </div>
    </>
  )
}

export function FeedPostSkeleton({ count = 2 }: { count?: number }) {
  return (
    <>
      <ShimmerStyleTag />
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ background: '#FFFFFF', borderRadius: '16px', padding: '14px', marginBottom: '14px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <Block width={38} height={38} radius={19} />
            <div style={{ flex: 1 }}>
              <Block width="40%" height={12} />
              <div style={{ height: 6 }} />
              <Block width="25%" height={10} />
            </div>
          </div>
          <Block width="100%" height={12} />
          <div style={{ height: 6 }} />
          <Block width="70%" height={12} />
          <div style={{ height: 10 }} />
          <Block width="100%" height={160} radius={12} />
        </div>
      ))}
    </>
  )
}

export function ProfileHeaderSkeleton() {
  return (
    <>
      <ShimmerStyleTag />
      <Block width="100%" height={140} radius={16} />
      <div style={{ display: 'flex', gap: '12px', marginTop: '-32px', paddingLeft: '16px', alignItems: 'flex-end' }}>
        <Block width={72} height={72} radius={36} style={{ border: '3px solid white' }} />
        <div style={{ flex: 1, paddingBottom: '4px' }}>
          <Block width="50%" height={14} />
          <div style={{ height: 6 }} />
          <Block width="30%" height={11} />
        </div>
      </div>
    </>
  )
}

export function QuickActionsSkeleton() {
  return (
    <>
      <ShimmerStyleTag />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ background: '#FFFFFF', borderRadius: '14px', padding: '14px 8px', textAlign: 'center' }}>
            <Block width={40} height={40} radius={10} style={{ margin: '0 auto' }} />
            <div style={{ height: 8 }} />
            <Block width="70%" height={10} style={{ margin: '0 auto' }} />
          </div>
        ))}
      </div>
    </>
  )
}

import { colors } from './constants'
import { CozyThingText } from '@lmthing/ui/elements/branding/cozy-text'

const members = [
  {
    name: 'Vasilis Kefallinos',
    role: 'Software Engineer',
    subtitle: '',
    image: 'https://media.licdn.com/dms/image/v2/D4D03AQE3LAcUEgiyDg/profile-displayphoto-shrink_400_400/profile-displayphoto-shrink_400_400/0/1648817529808?e=1774483200&v=beta&t=ffc4fSJI0n7gMyeOZDfyWiNvteKCn54lWHS5fqKx5E4',
  },
  {
    name: 'Thanos Vidakis',
    role: 'Software Engineer',
    subtitle: '',
    image: 'https://media.licdn.com/dms/image/v2/C4D03AQGZ5JdhnudPSw/profile-displayphoto-shrink_400_400/profile-displayphoto-shrink_400_400/0/1596229243641?e=1774483200&v=beta&t=y5hqBkfoWO-Yde_0cmVIdvNmFfVBXqnFdCPcNGtLdgs',
  },
  {
    name: 'Dimitris Maris',
    role: 'Educator - Domain Expert',
    subtitle: 'Matilda CEO',
    image: 'https://media.licdn.com/dms/image/v2/D4D03AQGksKxRuflKeQ/profile-displayphoto-scale_400_400/B4DZovGFVyIkAk-/0/1761726716430?e=1774483200&v=beta&t=gWq_aKmNcy6ykLX1EG9d6WGkU7uudy-o0IarjGDvH9Q',
  },
  {
    name: 'Vassilis Kourtis',
    role: 'Software Engineer',
    subtitle: '',
    image: 'https://media.licdn.com/dms/image/v2/C5603AQG2RMabm1NqIg/profile-displayphoto-shrink_400_400/profile-displayphoto-shrink_400_400/0/1516529896470?e=1774483200&v=beta&t=kYtVz3bbnzyBL1_SMoP0XJMvAZ--cXoL3-ph1A3N2zM',
  },
]

export default function Slide7Team() {
  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center"
      style={{ background: colors.bg }}
    >
      <h2 className="mb-16 flex items-center justify-center gap-3 text-7xl font-bold" style={{ color: colors.text }}>
        Team behind the <CozyThingText text="thing" className="text-7xl leading-loose" />
      </h2>

      <div className="flex gap-16">
        {members.map((m) => (
          <div key={m.name} className="flex flex-col items-center">
            <img
              src={m.image}
              alt={m.name}
              className="size-40 rounded-full border-4 object-cover"
              style={{ borderColor: colors.brand }}
            />
            <p className="mt-6 text-2xl font-bold" style={{ color: colors.text }}>
              {m.name}
            </p>
            <p className="mt-2 text-base" style={{ color: colors.muted }}>
              {m.role}
            </p>
            {m.subtitle && (
              <p className="mt-1 text-sm" style={{ color: colors.muted }}>
                {m.subtitle}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

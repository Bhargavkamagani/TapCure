import { Avatar } from '../hospital/ui.jsx'
import { fileUrl } from '../../api'
import { relationTone } from '../../lib/family.js'

/**
 * Avatar for "You" or a family member: the uploaded photo when there is one,
 * otherwise initials tinted by relationship. Used by the roster, the booking
 * person-picker and the history drawer so a person looks the same everywhere.
 */
export default function PersonAvatar({ person, isSelf = false, className = 'h-11 w-11 text-[13px]' }) {
  if (person?.photo_url) {
    return (
      <img
        src={fileUrl(person.photo_url)}
        alt={person.name || ''}
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    )
  }
  return (
    <Avatar
      name={person?.name || '?'}
      tone={isSelf ? 'bg-brand-blue' : relationTone(person?.relation)}
      className={`shrink-0 ${className}`}
    />
  )
}

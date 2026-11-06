/**
 * Display-only labels for the capitalised FamilyMember enums. The stored value
 * is never changed; anything without a translation is shown as it came.
 */
export function relLabel(t, relation) {
  if (!relation) return relation
  const k = `px.rel.${relation}`
  const s = t(k)
  return s === k ? relation : s
}

export function genderLabel(t, gender) {
  if (!gender) return gender
  const k = `ppage.gender${gender[0].toUpperCase()}${gender.slice(1).toLowerCase()}`
  const s = t(k)
  return s === k ? gender : s
}

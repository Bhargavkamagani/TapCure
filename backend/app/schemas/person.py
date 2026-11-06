"""First name / last name on the request and response schemas for people.

Requests: `first_name` / `last_name` are optional, so an old app build that
still sends only `name` keeps working. When a first name is sent, `name` (the
full name every screen reads) is rebuilt from the two — see services/person_name,
which also keeps the database rows consistent and preserves a title like "Dr.".
"""
from typing import Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from ..services.english_text import to_english_name
from ..services.person_name import clean, join_name


class NamePartsIn(BaseModel):
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)

    _en_parts = field_validator("first_name", "last_name")(to_english_name)

    @model_validator(mode="after")
    def _full_name_from_parts(self):
        first = clean(self.first_name)
        if first and "name" in type(self).model_fields:
            self.first_name, self.last_name = first, clean(self.last_name) or None
            self.name = join_name(first, self.last_name)
        return self


class NamePartsOut(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None


class OwnerNamePartsIn(BaseModel):
    """Hospital signup: the owner's name arrives as owner_first_name / owner_last_name."""
    owner_first_name: Optional[str] = Field(None, max_length=100)
    owner_last_name: Optional[str] = Field(None, max_length=100)

    _en_owner_parts = field_validator("owner_first_name", "owner_last_name")(to_english_name)

    @model_validator(mode="after")
    def _owner_name_from_parts(self):
        first = clean(self.owner_first_name)
        if first:
            self.owner_first_name, self.owner_last_name = first, clean(self.owner_last_name) or None
            self.owner_name = join_name(first, self.owner_last_name)
        return self

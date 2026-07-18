from fastapi import APIRouter, Depends, HTTPException

from app.auth import require_user_id
from app.models.schemas import SavedPeopleResponse, SavedPerson, SavedPersonRequest
from app.services.saved_people import create_saved_person, delete_saved_person, list_saved_people

router = APIRouter()

# Plain CRUD gated by require_user_id, same as charts.py/profile.py - no
# rate limiting (no ephemeris/Claude work of its own).

_NOT_FOUND_DETAIL = {
    "error": "not_found",
    "message": "That saved person doesn't exist or has already been deleted.",
}


@router.post("/api/people", response_model=SavedPerson)
def create_person(
    payload: SavedPersonRequest, user_id: str = Depends(require_user_id)
) -> SavedPerson:
    return create_saved_person(user_id, payload)


@router.get("/api/people/mine", response_model=SavedPeopleResponse)
def get_my_people(user_id: str = Depends(require_user_id)) -> SavedPeopleResponse:
    return SavedPeopleResponse(people=list_saved_people(user_id))


@router.delete("/api/people/{person_id}", status_code=204)
def delete_person(person_id: str, user_id: str = Depends(require_user_id)) -> None:
    deleted = delete_saved_person(person_id, user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=_NOT_FOUND_DETAIL)

import {
  sendTrustRequest,
  acceptRequest,
  getLayer1Contacts,
  searchUserByPhone,
} from "./services/trustService";

async function test() {
  try {
    console.log("Searching user...");

    const user = await searchUserByPhone("+919999999999");

    console.log(user);

    if (!user) {
      console.log("User not found");
      return;
    }

    const requestId = await sendTrustRequest("YOUR_UID", user.id);

    console.log("Request Created:", requestId);

    await acceptRequest(requestId);

    console.log("Accepted");

    const contacts = await getLayer1Contacts("YOUR_UID");

    console.log(contacts);
  } catch (err) {
    console.error(err);
  }
}

test();

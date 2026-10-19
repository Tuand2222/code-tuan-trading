import { redirect } from "next/navigation";

export default function DisabledSignInPage() {
  redirect("/signin-with-chatgpt?return_to=%2F");
}

"use server";
import { revalidatePath } from "next/cache";import { redirect } from "next/navigation";import { createClient } from "@/lib/supabase/server";
export async function deleteProduct(productId:string){const s=await createClient();const{data:c}=await s.auth.getClaims();const userId=c?.claims?.sub;if(!userId)redirect("/login");const{error}=await s.from("products").delete().eq("id",productId).eq("user_id",userId);if(error)redirect(`/products?error=${encodeURIComponent(error.message)}`);revalidatePath("/");revalidatePath("/products");redirect("/products?deleted=1")}

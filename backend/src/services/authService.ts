import usermodel from "../models/User";
import mongoose from "mongoose";
import bcryptjs from "bcryptjs";
import jsonwebtoken from "jsonwebtoken";
import AppError from "../utils/AppError";

async function registerUser(name: string, password: string, email?: string) {
 
    const username = name.trim().toLowerCase();
    const hash_password = password.trim();
    email = email?.trim();

    if (username.length < 3 || hash_password.length < 6) {
      throw new AppError ( "invalid input",400);
    }

    const dedupeuser = await usermodel.findOne({ username });
    if (dedupeuser) {
      throw new  AppError ( "Username is already taken",409);
    }

    const hashedPassowrd = await bcryptjs.hash(hash_password, 11);

    const userdata = await usermodel.create({
      username: username,
      email: email,
      passwordHash: hashedPassowrd,
    });

    const jwt_Token = tokenhelper(userdata._id, userdata.username);

    return {
      userdata: {
        name: userdata.username,
        email: userdata.email,
        updatedAt: userdata.updatedAt,
      },
      token: jwt_Token,
    };
 
}

async function loginuser(username: string, password: string) {
 
    username = username.trim().toLowerCase();
    password = password.trim();
    if (username.length < 3 || password.length < 6) {
      throw new AppError ( "invalid input",400);
    }

    const existinguser = await usermodel.findOne({ username });
    if (!existinguser) {
      throw new AppError ("Invalid credentials",401);
    }
    const passwordmatch = await bcryptjs.compare(password, existinguser.passwordHash);
    if (!passwordmatch) {
     throw new AppError ("Invalid credentials",401);
    }
    const jwt_Token = tokenhelper(existinguser._id, existinguser.username);

    return {
      userdata: {
        name: existinguser.username,
        email: existinguser.email,
        updatedAt: existinguser.updatedAt,
      },
      token: jwt_Token,
    };
  
}

function tokenhelper(userid: mongoose.Types.ObjectId, username: string) {
  const jwtsecret = process.env.JWT_SECRET;
  if (!jwtsecret) {
    throw new AppError ("JWT Secret is missing",404);
  }
  const payload = {
    name: username,
    id: userid,
  };
  const jwt_token = jsonwebtoken.sign(payload, jwtsecret, { expiresIn: "7d" });

  return jwt_token;
}

export  {registerUser,loginuser};
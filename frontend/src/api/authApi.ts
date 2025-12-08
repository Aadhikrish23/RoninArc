
import api from "./axiosInstance";

interface RegisterSuccess {
  userdata: {
    name: string;
    email?: string;
    updatedAt: string;
  };
  token: string;
}

interface LoginSuccess {
  userdata: {
    name: string;
    email?: string;
    updatedAt: string;
  };
  token: string;
}
const userLogin = async (
  name: string,
  password: string
): Promise<LoginSuccess> => {
    
  const uesrdata = await api.post<{ Status: string; Data: LoginSuccess }>(
    "auth/login",
    {
      username: name.trim(),
      password: password.trim(),
    }
  );
  return uesrdata.data.Data;
};


const userSignup = async (name:string,password:string,email?:string):Promise<RegisterSuccess> =>{
  email = (email === undefined)?"":email.trim();
  const userdata = await api.post<{Status:String;Data:RegisterSuccess}>(
    "auth/signup",
    {
      username:name.trim(),
      password:password.trim(),
      email:email,
    }
  );
  return userdata.data.Data;

}
export default {userLogin,userSignup};

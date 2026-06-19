import { ViewOffIcon, ViewIcon } from "@chakra-ui/icons";
import {
  Text,
  Link,
  Flex,
  Box,
  Stack,
  Heading,
  Divider,
  FormControl,
  FormLabel,
  Input,
  InputGroup,
  InputRightElement,
  Button,
  Checkbox,
  Tag,
  useToast,
} from "@chakra-ui/react";
import { useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import authApi from "../api/authApi";
// import { deleteCurrentUser } from "../utils/auth";
import DynamicBackground from "../../../shared/components/DynamicBackground";
import { useAuth } from "../context/AuthContext";
import { getErrorMessage } from "../../../shared/utils/error";

function Signup() {
  const [show, setShow] = useState<boolean>(false);
  const [username, setUsername] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmpassword, setConfirmPassword] = useState<string>("");
  const [saveme, setSaveme] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  const [emailErrorShown, setEmailErrorShown] = useState(false);

  const navigate = useNavigate();
  const toast = useToast();
  const { login } = useAuth();

  function handleClick() {
    setShow(!show);
  }

  function handleSaveme() {
    setSaveme(!saveme);
  }
  const isValidEmail = (mail: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(mail);
  };

  const handlesubmit = async () => {
    try {
      setLoading(true);

      const name = username.trim();
      const pass = password.trim();
      const confirm = confirmpassword.trim();
      const mail = email ? email.trim() : "";

      if (!name || !pass) {
        throw new Error("Username and password are required");
      }

      if (pass !== confirm) {
        throw new Error("Password and Confirm Password must be the same");
      }

      // ✅ Email format check (if email is provided)
      if (mail && !isValidEmail(mail)) {
        setEmail("");
        throw new Error("Please enter a valid email address");
      }

      const datas = await authApi.userSignup(name, pass, mail);

      // Clear old user data
      // deleteCurrentUser();
      console.log("SIGNUP RESPONSE", datas);

      login(datas.userdata, datas.accessToken, datas.refreshToken, saveme);

      console.log(
        "TOKEN AFTER LOGIN",
        sessionStorage.getItem("roninarc_token"),
        localStorage.getItem("roninarc_token"),
      );

      toast({
        title: "Signup successful",
        description: "Your RoninArc account has been created.",
        status: "success",
        duration: 3000,
        isClosable: true,
        position: "top",
      });

      // Go to login page
      navigate("/");
    } catch (error: unknown) {
  toast({
    title: "Signup failed",
    description: getErrorMessage(error),
    status: "error",
    duration: 4000,
    isClosable: true,
    position: "top",
  });
} finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <DynamicBackground>
        <Flex minH="100vh" align="center" justify="center" px={4} py={8}>
          <Box
            w="full"
            maxW="md"
            width={["90%", "460px", "500px"]}
            bg="gray.800"
            borderRadius="xl"
            boxShadow="8px 8px 15px #ff004d"
            p={[6, 7]}
          >
            {/* Brand / Title */}
            <Stack spacing={1} mb={6} textAlign="center" direction="column">
              <Heading size="lg" color="white">
                ⚔️ Welcome Ronin ⚔️
              </Heading>

              <Tag
                bg="transparent"
                color="#98272b"
                mt={5}
                p={4}
                alignSelf="center"
              >
                Forge Your Game Path
              </Tag>
            </Stack>

            <Divider mb={6} borderColor="gray.700" />

            {/* Form fields */}
            <Stack spacing={4}>
              <FormControl>
                <FormLabel color="gray.200">Username</FormLabel>
                <Input
                  placeholder="Enter your username"
                  bg="gray.900"
                  color="#fff"
                  borderColor="gray.700"
                  _hover={{ borderColor: "gray.500" }}
                  _focus={{
                    borderColor: "purple.400",
                    boxShadow: "0 0 0 1px #9F7AEA",
                  }}
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                  }}
                />
              </FormControl>

              <FormControl>
                <FormLabel color="gray.200">Email </FormLabel>
                <Input
                  placeholder="Enter your email"
                  bg="gray.900"
                  color="#fff"
                  borderColor="gray.700"
                  _hover={{ borderColor: "gray.500" }}
                  _focus={{
                    borderColor: "purple.400",
                    boxShadow: "0 0 0 1px #9F7AEA",
                  }}
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailErrorShown(false); // reset error when typing
                  }}
                  onBlur={() => {
                    if (
                      email.trim() &&
                      !isValidEmail(email.trim()) &&
                      !emailErrorShown
                    ) {
                      toast({
                        title: "Invalid Email",
                        description: "Please enter a valid email address",
                        status: "error",
                        duration: 3000,
                        isClosable: true,
                        position: "top",
                      });
                      setEmailErrorShown(true);
                      setEmail("");
                    }
                  }}
                />
              </FormControl>

              <FormControl>
                <FormLabel color="gray.200">Password</FormLabel>
                <InputGroup>
                  <Input
                    type={show ? "text" : "password"}
                    placeholder="Enter your password"
                    bg="gray.900"
                    color="#fff"
                    borderColor="gray.700"
                    _hover={{ borderColor: "gray.500" }}
                    _focus={{
                      borderColor: "purple.400",
                      boxShadow: "0 0 0 1px #9F7AEA",
                    }}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                    }}
                  />
                  <InputRightElement>
                    <Button
                      h="1.75rem"
                      size="sm"
                      onClick={handleClick}
                      bg="#00000000"
                      color="#fff"
                      _hover={{ bg: "#00000000" }}
                    >
                      {show ? <ViewOffIcon /> : <ViewIcon />}
                    </Button>
                  </InputRightElement>
                </InputGroup>
              </FormControl>

              <FormControl>
                <FormLabel color="gray.200">Confirm Password</FormLabel>
                <InputGroup>
                  <Input
                    type={show ? "text" : "password"}
                    placeholder="Confirm your password"
                    bg="gray.900"
                    color="#fff"
                    borderColor="gray.700"
                    _hover={{ borderColor: "gray.500" }}
                    _focus={{
                      borderColor: "purple.400",
                      boxShadow: "0 0 0 1px #9F7AEA",
                    }}
                    value={confirmpassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                    }}
                  />
                  <InputRightElement />
                </InputGroup>
              </FormControl>

              {/* Remember me */}
              <Flex justify="space-between" align="center" fontSize="sm">
                <Checkbox
                  colorScheme="purple"
                  color="gray.200"
                  checked={saveme}
                  onChange={handleSaveme}
                >
                  Remember me
                </Checkbox>
              </Flex>

              {/* Signup button */}
              <Button
                mt={2}
                w="full"
                colorScheme="purple"
                size="md"
                onClick={handlesubmit}
                isLoading={loading}
                loadingText="Creating account..."
              >
                SignUp
              </Button>
            </Stack>

            {/* Footer: Login link */}
            <Text mt={6} fontSize="sm" color="gray.400" textAlign="center">
              Already have an account?{" "}
              <Link
                as={RouterLink}
                to="/login"
                color="purple.300"
                _hover={{ color: "purple.200" }}
              >
                Login
              </Link>
            </Text>
          </Box>
        </Flex>
      </DynamicBackground>
    </div>
  );
}

export default Signup;

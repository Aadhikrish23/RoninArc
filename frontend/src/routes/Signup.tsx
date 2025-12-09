import { ViewOffIcon, ViewIcon } from "@chakra-ui/icons";
import {
  Container,
  Text,
  Link,
  AbsoluteCenter,
  Spinner,
  Alert,
  AlertIcon,
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
  Spacer,
} from "@chakra-ui/react";
import React, { useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import authApi from "../api/authApi";
import { deleteCurrentUser } from "../utils/auth";
import DynamicGameBackground from "../components/DynamicBackground";
import DynamicBackground from "../components/DynamicBackground";

function Signup() {
  const [show, setShow] = useState<boolean>(false);
  const [username, setUsername] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [Confirmpassword, setConfirmPassword] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [saveme, setSaveme] = useState<boolean>(false);
  const navigate = useNavigate();
  function handleClick() {
    setShow(!show);
  }
  function handleSaveme() {
    setSaveme(!saveme);
  }

  const handlesubmit = async () => {
    try {
      setLoading(true);
      setError("");
      setStatus("");
      let name = username.trim();
      let pass = password.trim();
      let confirm = Confirmpassword.trim();
      let mail = email === undefined ? "" : email.trim();
      if (pass !== confirm) {
        throw new Error("Password must be same...");
      }
      if (name === "" || pass === "") {
        throw new Error("Invalid inputs");
      }
      const datas = await authApi.userSignup(name, pass, mail);
      if (saveme) {
        localStorage.setItem("roninarc_user", JSON.stringify(datas.userdata));
        localStorage.setItem("roninarc_token", datas.token);
      }
      deleteCurrentUser();

      sessionStorage.setItem("roninarc_token", datas.token);
      sessionStorage.setItem("roninarc_user", JSON.stringify(datas.userdata));
      setStatus("Signup sucessfully...");
      navigate("/");
    } catch (error: any) {
      let errmgs;
      if (error.response && error.response.data) {
        errmgs = error.response.data.error || error.response.data.message;
      } else {
        errmgs = error.toString();
      }

      setError(errmgs);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div>
      <Container>
        {loading && (
          <AbsoluteCenter axis="both">
            <Spinner color="red.500" size="xl" />
          </AbsoluteCenter>
        )}
        {error && (
          <AbsoluteCenter axis="horizontal" p={4}>
            <Alert status="error">
              <AlertIcon />
              {error}
            </Alert>
          </AbsoluteCenter>
        )}

        {status && (
          <AbsoluteCenter axis="horizontal" p={4}>
            <Alert status="success">
              <AlertIcon />
              {status}
            </Alert>
          </AbsoluteCenter>
        )}
      </Container>
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

              <AbsoluteCenter axis="horizontal">
                {" "}
                <Tag bg="transparent" color="#98272b" mt={5} p={4}>
                  Forge Your Game Path
                </Tag>
              </AbsoluteCenter>
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
                  onChange={(e) => {
                    setUsername(e.target.value);
                  }}
                />
              </FormControl>
              <FormControl>
                <FormLabel color="gray.200">Email</FormLabel>
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
                  type="email"
                  onChange={(e) => {
                    setEmail(e.target.value);
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
                    placeholder="Enter your password"
                    bg="gray.900"
                    color="#fff"
                    borderColor="gray.700"
                    _hover={{ borderColor: "gray.500" }}
                    _focus={{
                      borderColor: "purple.400",
                      boxShadow: "0 0 0 1px #9F7AEA",
                    }}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                    }}
                  />
                  <InputRightElement></InputRightElement>
                </InputGroup>
              </FormControl>

              {/* Remember + Forgot */}
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

              {/* Login button */}
              <Button
                mt={2}
                w="full"
                colorScheme="purple"
                size="md"
                onClick={() => handlesubmit()}
              >
                SignUp
              </Button>
            </Stack>

            {/* Footer: Sign up link */}
            <Text mt={6} fontSize="sm" color="gray.400" textAlign="center">
              Already having account ?{" "}
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

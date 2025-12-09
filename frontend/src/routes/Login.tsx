import {
  Text,
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
  Checkbox,
  Link,
  Button,
  Image,
  Spacer,
  Container,
  Spinner,
  AbsoluteCenter,
  Alert,
  AlertIcon,
} from "@chakra-ui/react";
import { ViewIcon, ViewOffIcon } from "@chakra-ui/icons";

import React, { useState } from "react";

import authApi from "../api/authApi";
import DynamicBackground from "../components/DynamicBackground";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { deleteCurrentUser } from "../utils/auth";

function Login() {
  const [show, setShow] = useState<boolean>(false);
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
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
      if (name === "" || pass === "") {
        throw new Error("Invalid inputs");
      }
      const datas = await authApi.userLogin(name, pass);
   deleteCurrentUser();

      if (saveme) {
        localStorage.setItem("roninarc_user", JSON.stringify(datas.userdata));
        localStorage.setItem("roninarc_token", datas.token);
      }
      sessionStorage.setItem("roninarc_token", datas.token);
      sessionStorage.setItem("roninarc_user", JSON.stringify(datas.userdata));

      setStatus("Login sucessfully...");
      navigate("/Home");
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
      <Flex minH="100vh"  align="center" justify="center" px={4}>
        <Box
          w="full"
          maxW="md"
          bg="gray.800"
          borderRadius="xl"
          boxShadow="8px 8px 15px #ff004d"
          p={8}
        >
          {/* Brand / Title */}
          <Stack spacing={1} mb={6} textAlign="center">
            <Heading size="lg" color="white">
              Welcome back, Ronin ⚔️
            </Heading>
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
              {/* <Link color="purple.300" _hover={{ color: "purple.200" }}>
                Forgot password?
              </Link> */}
            </Flex>

            {/* Login button */}
            <Button
              mt={2}
              w="full"
              colorScheme="purple"
              size="md"
              onClick={() => handlesubmit()}
            >
              Login
            </Button>
          </Stack>

          {/* Footer: Sign up link */}
          <Text mt={6} fontSize="sm" color="gray.400" textAlign="center">
            Don&apos;t have an account?{" "}
            <Link
              as={RouterLink}
              to="/Signup"
              color="purple.300"
              _hover={{ color: "purple.200" }}
            >
              SignUp
            </Link>
          </Text>
        </Box>
      </Flex>
      </DynamicBackground>
    </div>

  );
}

export default Login;

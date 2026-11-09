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
  useToast,
} from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import syncApi from "../../settings/api/syncApi";
import { setSyncPreference, syncPreference, syncWithOtherDevices } from "../../settings/syncOtherDevices";
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
  const [syncDevices, setSyncDevices] = useState<boolean>(syncPreference);
  // Is the name free in RoninArc Cloud? Asked while typing, only when syncing is ticked.
  const [cloudName, setCloudName] = useState<{ name: string; available: boolean; suggestions: string[] } | null>(null);

  useEffect(() => {
    const name = username.trim().toLowerCase();
    if (!syncDevices || name.length < 3) return;
    let live = true;
    const timer = setTimeout(() => {
      syncApi
        .nameAvailable(name)
        .then((r) => live && setCloudName({ name, ...r }))
        // Offline, or the cloud isn't set up in this build: say nothing; the sign-up still works.
        .catch(() => live && setCloudName({ name, available: true, suggestions: [] }));
    }, 500);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [username, syncDevices]);
  // Only the answer for the name in the box now (and only while syncing is ticked).
  const nameTaken = syncDevices && !!cloudName && !cloudName.available && cloudName.name === username.trim().toLowerCase();

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

  // Enter and a click in the same moment both see loading=false; a ref stops the second request
  // (it came back "Username is already taken" for the account the first one had just made).
  const submitting = useRef(false);
  const handlesubmit = async () => {
    if (submitting.current) return;
    submitting.current = true;
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
        throw new Error("Password and Confirm password must be the same");
      }

      // ✅ Email format check (if email is provided)
      if (mail && !isValidEmail(mail)) {
        setEmail("");
        throw new Error("Please enter a valid email address");
      }

      const datas = await authApi.userSignup(name, pass, mail);

      // Clear old user data
      // deleteCurrentUser();
      login(datas.userdata, datas.accessToken, datas.refreshToken, saveme);
      setSyncPreference(syncDevices);
      // In the background: the account exists here whatever happens with the cloud.
      if (syncDevices) void syncWithOtherDevices({ password: pass, rememberMe: saveme, email: mail, login, toast });


      toast({
        title: "Signup successful",
        description: "Your RoninArc account has been created.",
        status: "success",
        duration: 3000,
        isClosable: true,
      });

      // Go to login page
      navigate("/");
    } catch (error: unknown) {
  toast({
    title: "Signup failed",
    description: getErrorMessage(error),
    status: "error",
    duration: 7000,
    isClosable: true,
  });
} finally {
      submitting.current = false;
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
                Welcome, Ronin
              </Heading>


            </Stack>

            <Divider mb={6} borderColor="gray.700" />

            {/* Form fields */}
            {/* Enter in any field submits. */}
            <Stack spacing={4} onKeyDown={(e) => { if (e.key === "Enter" && !loading && (e.target as HTMLElement).tagName !== "BUTTON") handlesubmit(); }}>
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
                  aria-describedby="cloud-name-note"
                />
                {nameTaken && (
                  <Box id="cloud-name-note" mt={2} fontSize="sm" color="orange.200" aria-live="polite">
                    <Text>That name is taken in RoninArc Cloud, so it can't be used for syncing. You can still use it on this PC.</Text>
                    {cloudName!.suggestions.length > 0 && (
                      <Flex mt={2} gap={2} flexWrap="wrap" align="center">
                        <Text as="span" color="gray.300">
                          Free:
                        </Text>
                        {cloudName!.suggestions.map((s) => (
                          <Button key={s} size="xs" variant="outline" colorScheme="purple" onClick={() => setUsername(s)}>
                            {s}
                          </Button>
                        ))}
                      </Flex>
                    )}
                  </Box>
                )}
              </FormControl>

              <FormControl>
                <FormLabel color="gray.200">
                  Email{" "}
                  {syncDevices && (
                    <Text as="span" fontSize="xs" color="gray.400" fontWeight="normal">
                      (needed for syncing, and to reset a forgotten password)
                    </Text>
                  )}
                </FormLabel>
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
                <FormLabel color="gray.200">Confirm password</FormLabel>
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
              <Checkbox colorScheme="purple" color="gray.200" isChecked={syncDevices} onChange={(e) => setSyncDevices(e.target.checked)}>
                <Text as="span" fontSize="sm">
                  Sync with my other devices
                </Text>
              </Checkbox>

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
                Sign up
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
                Log in
              </Link>
            </Text>
          </Box>
        </Flex>
      </DynamicBackground>
    </div>
  );
}

export default Signup;

import { useEffect, useState, useRef } from "react";
import { supabase } from "../supabaseCliend";
import { FcGoogle } from "react-icons/fc";
import { RiRadioButtonLine } from "react-icons/ri";
import { FaSignOutAlt } from "react-icons/fa";

const siteUrl = import.meta.env.VITE_SITE_URL;

function App() {
  const [session, setSession] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [usersOnline, setUsersOnline] = useState([]);

  const chatContainerRef = useRef(null);
  const scroll = useRef();
  const inputRef = useRef(null);

  // Handle Enter key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Enter" && newMessage.trim() !== "") {
        e.preventDefault();
        sendMessage(e);
      }
    };

    const input = inputRef.current;
    if (input) {
      input.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      if (input) {
        input.removeEventListener("keydown", handleKeyDown);
      }
    };
  }, [newMessage]);

  // Auth session handling
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Chat room handling
  useEffect(() => {
    if (!session?.user) {
      setUsersOnline([]);
      return;
    }

    const roomOne = supabase.channel("room_one", {
      config: {
        presence: {
          key: session?.user?.id,
        },
      },
    });

    roomOne.on("broadcast", { event: "message" }, (payload) => {
      setMessages((prevMessage) => [...prevMessage, payload.payload]);
    });

    // Track users presence
    roomOne.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await roomOne.track({
          id: session?.user?.id,
        });
      }
    });

    // Handle user presence
    roomOne.on("presence", { event: "sync" }, () => {
      const state = roomOne.presenceState();
      setUsersOnline(Object.keys(state));
    });

    return () => {
      roomOne.unsubscribe();
    };
  }, [session]);

  // Auto-scroll
  useEffect(() => {
    setTimeout(() => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop =
          chatContainerRef.current.scrollHeight;
      }
    }, 100);
  }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    supabase.channel("room_one").send({
      type: "broadcast",
      event: "message",
      payload: {
        message: newMessage,
        user_name: session?.user?.email,
        avatar:
          session?.user?.user_metadata?.picture ||
          session?.user?.user_metadata?.avatar_url,
        timestamp: new Date().toISOString(),
      },
    });
    setNewMessage("");
  };

  const formatTime = (isoString) => {
    return new Date(isoString).toLocaleTimeString("en-us", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const signIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: siteUrl,
      },
    });
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
  };

  if (!session) {
    return (
      <div className="w-full flex h-screen justify-center items-center">
        <button
          onClick={signIn}
          className=" bg-neutral-700 text-white text-sm font-semibold px-6 py-2 rounded-md flex items-center gap-2"
        >
          <span>
            <FcGoogle />
          </span>
          Sign in with google
        </button>
      </div>
    );
  }

  return (
    <div className="w-full flex justify-center items-center p-4">
      <div className="border-[1px] border-gray-700 max-w-6xl w-full grid grid-rows-[auto_1fr_auto] min-h-screen  rounded-lg">
        {/* Header */}
        <div className="flex justify-between items-center border-b-[1px] h-24 border-gray-700">
          <div className="p-4 max-w-[50%] sm:max-w-[70%]">
            <p className="text-gray-300 font-semibold">
              Signed in as
              <span className="italic text-sm text-blue-500 px-1">
                {session?.user?.email}
              </span>
            </p>
            <p className="text-gray-300 text-xs flex items-center gap-1">
              <span className=" text-green-500">
                <RiRadioButtonLine />
              </span>
              {usersOnline.length} users online
            </p>
          </div>
          <div>
            <button
              onClick={signOut}
              className="m-2 sm:mr-4 flex items-center gap-2 text-gray-300 bg-[#191919] px-4 py-3 font-semibold capitalize text-xs rounded-md cursor-pointer hover:bg-gray-800 transition-all duration-300"
            >
              Sign out
              <span className=" text-md">
                <FaSignOutAlt />
              </span>
            </button>
          </div>
        </div>

        {/* Chat messages */}
        <div
          ref={chatContainerRef}
          className="p-4 flex flex-col overflow-y-auto min-h-0 text-white"
        >
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`my-2 flex w-full ${
                msg?.user_name === session?.user?.email
                  ? "justify-end"
                  : "justify-start"
              }`}
            >
              {msg?.user_name !== session?.user?.email && (
                <img
                  src={msg.avatar}
                  alt="avatar"
                  className="w-10 h-10 rounded-full mr-2"
                />
              )}

              <div className="flex flex-col max-w-[80%]">
                <div
                  className={`p-3 rounded-xl ${
                    msg?.user_name === session?.user?.email
                      ? "bg-gray-700 text-white"
                      : "bg-gray-500 text-white"
                  }`}
                >
                  <p>{msg.message}</p>
                </div>
                <div
                  className={`text-xs opacity-75 pt-1 ${
                    msg?.user_name === session?.user?.email
                      ? "text-right"
                      : "text-left"
                  }`}
                >
                  {formatTime(msg?.timestamp)}
                </div>
              </div>

              {msg?.user_name === session?.user?.email && (
                <img
                  src={msg.avatar}
                  alt="avatar"
                  className="w-10 h-10 rounded-full ml-2"
                />
              )}
            </div>
          ))}
        </div>

        {/* Message input */}
        <form
          onSubmit={sendMessage}
          className="flex flex-col sm:flex-row p-4 border-t-[1px] h-32 sm:h-20 border-gray-700 gap-2"
        >
          <input
            ref={inputRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            type="text"
            placeholder="Type a message and press Enter..."
            className="p-3 w-full bg-[#191919] rounded-lg text-gray-300 text-xs sm:text-sm tracking-wider"
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className={`px-4 py-2 rounded-lg transition-colors font-semibold ${
              newMessage.trim()
                ? "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                : "bg-[#191919] text-gray-400 cursor-not-allowed"
            }`}
          >
            Send
          </button>
          <span ref={scroll}></span>
        </form>
      </div>
    </div>
  );
}

export default App;

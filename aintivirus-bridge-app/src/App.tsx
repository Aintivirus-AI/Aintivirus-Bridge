import { useAccount, useConnect, useDisconnect } from "wagmi";
import Button from "@mui/material/Button";
import { FormControl, InputLabel, Select, MenuItem, Box, TextField, Container, SelectChangeEvent } from "@mui/material";
import Grid from "@mui/material/Grid2";
import { useState } from "react";
import { usePhantomWallet } from "./hooks/usePhantomWallet";
import SendButton from "./SendButton";
import BridgeConfig from "./bridge-config";
import { NumericFormat } from "react-number-format";

const { solana, ethereum } = BridgeConfig;

function App() {
  const account = useAccount();

  const { connectors, connect } = useConnect();
  const { disconnect } = useDisconnect();
  const [connector] = connectors;
  const { publicKey, handleDisconnect, handleConnect } = usePhantomWallet();
  const solanaAddress = !!publicKey ? publicKey.toBase58() : undefined;
  const ethereumAddress = !!account ? account.address : undefined;

  const [fromEid, setFromEid] = useState(solana.eid.toString());
  const [toEid, setToEid] = useState(ethereum.eid.toString());
  const [amount, setAmount] = useState("");

  const chains = [
    { ...ethereum, address: ethereumAddress },
    { ...solana, address: solanaAddress },
  ];
  const eids = chains.map(({ eid }) => eid.toString());

  const handleFromEidChange = (event: SelectChangeEvent) => {
    const newFromEid = event.target.value as string;
    setFromEid(newFromEid);
    const another = newFromEid == eids[0] ? eids[1] : eids[0];
    setToEid(another);
  };

  const handleToEidChange = (event: SelectChangeEvent) => {
    const newToEid = event.target.value as string;
    setToEid(newToEid);
    const another = newToEid == eids[0] ? eids[1] : eids[0];
    setFromEid(another);
  };

  return (
    <>
      <Container maxWidth="md">
        <Box sx={{ flexGrow: 1 }}>
          <Grid container spacing={2}>
            <Grid container size={12}>
              {" "}
              {/* METAMASK */}
              <div>
                {!account.isConnected && (
                  <Button variant="contained" key={connector.uid} onClick={() => connect({ connector })}>
                    Connect to MetaMask
                  </Button>
                )}
                {account.isConnected && (
                  <Button variant="contained" onClick={() => disconnect()}>
                    Disconnect MetaMask
                  </Button>
                )}
              </div>
              {/* PHANTOM */}
              <div>
                {!publicKey && (
                  <Button variant="contained" key={"sol-connect"} onClick={handleConnect}>
                    Connect to Phantom
                  </Button>
                )}
                {publicKey && (
                  <Button variant="contained" key={"sol-disconnect"} onClick={handleDisconnect}>
                    Disconnect Phantom
                  </Button>
                )}
              </div>
            </Grid>

            <Grid size={12}>
              <FormControl fullWidth>
                <InputLabel>From</InputLabel>
                <Select id="from-select" label="From" value={fromEid} onChange={handleFromEidChange}>
                  {chains.map((chain) => (
                    <MenuItem key={chain.eid} value={chain.eid}>
                      {chain.name}
                      {chain.address && ` - ${chain.address}`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={12}>
              {" "}
              <FormControl fullWidth>
                <InputLabel>To</InputLabel>
                <Select id="to-select" label="To" value={toEid} onChange={handleToEidChange}>
                  {chains.map((chain) => (
                    <MenuItem key={chain.eid} value={chain.eid}>
                      {chain.name}
                      {chain.address && ` - ${chain.address}`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={12}>
              <FormControl fullWidth>
                <NumericFormat
                  customInput={TextField}
                  id="amount"
                  name="amount"
                  label="Amount"
                  variant="outlined"
                  onChange={(e) => setAmount(e.target.value)}
                  allowNegative={false}
                  thousandSeparator
                  decimalScale={6}
                />
              </FormControl>
            </Grid>
            <Grid size={12}>
              <SendButton fromEid={fromEid} toEid={toEid} amount={amount} />
            </Grid>
          </Grid>
        </Box>
      </Container>
    </>
  );
}

export default App;
